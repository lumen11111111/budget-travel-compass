import {
  createOperationPlan,
  decideOperation,
  determineOwnership,
  generateSessionSecret,
  stableJson,
  type AllowFlags,
  type OperationPlan,
  type RemoteExecutionOptions,
} from "./cloudflare-execution";
import type { BootstrapConfigInput } from "./production-bootstrap";
import type { AdapterResult, ControlledCloudflareAdapter, D1Resource, R2Resource } from "./cloudflare-adapter";
import { acquireProductionLock, releaseProductionLock } from "./production-lock";
import { appendOperationRecord } from "./production-audit";
import crypto from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { projectRoot } from "./cli-utils";
import { findUnfinishedProductionPatches, patchProductionConfig, type ConfigPatchResult } from "./production-config-patch";
import { sha256 } from "./production-patches";
import { buildProductionArtifact, preflightSecrets, resolveD1SqlSources, verifyD1PostWrite, verifySafeSqlSources, type D1SqlSource, type Phase4Result } from "./production-phase4";
import { evaluateProductionResourceAuthorization, hashProductionResourceSet, type ProductionAuthorizationEvidence, type ProductionResourceAuthorizationResult } from "./production-resource-authorization";

export type ControlledWorkflowReport = {
  mode: "remote-plan" | "remote-check" | "execute" | "resume";
  adapter: string;
  wranglerVersion: string;
  riskLevel: number;
  accountId: string;
  summary: "passed" | "blocked" | "action-required" | "failed";
  planHash: string;
  checks: Array<{ id: string; status: string; detail: string }>;
  operations: OperationPlan[];
  remoteCalls: string[];
  executionReportPath?: string;
};

type ExecutionStepResult = {
  stepId: string;
  operationKey: string;
  resource: string;
  action: string;
  startedAt: string;
  completedAt: string;
  outcome: "success" | "blocked" | "failed" | "skipped";
  errorCode?: string;
  evidence?: string;
  durationMs: number;
};

export type WriteAuthorizationDecision = {
  stepId: string;
  planned: boolean;
  requiredFlags: Array<keyof AllowFlags>;
  authorized: boolean;
  reason: string;
};

export async function runControlledCloudflareWorkflow(input: {
  config: BootstrapConfigInput;
  options: RemoteExecutionOptions;
  adapter: ControlledCloudflareAdapter;
}): Promise<ControlledWorkflowReport> {
  const { config, options, adapter } = input;
  const mode = options.execute ? "execute" : options.resume ? "resume" : options.remoteCheck || options.remote ? "remote-check" : "remote-plan";
  const accountId = options.accountId || config.cloudflareAccountId;
  const version = await adapter.getWranglerVersion();
  const wranglerVersion = version.resource ?? version.rawSummary;
  const checks: ControlledWorkflowReport["checks"] = [
    { id: "adapter", status: "pass", detail: `adapter=${options.adapterMode}; default is offline unless explicitly changed.` },
    { id: "wrangler-version", status: version.ok ? "pass" : version.status, detail: `${wranglerVersion}; source=${adapter.mode}` },
  ];
  const localConfigHashes = readLocalConfigHashes();

  const auth = await adapter.getAuthStatus();
  checks.push({ id: "auth", status: auth.resource?.authenticated ? "pass" : options.adapterMode === "offline" ? "skip" : "action-required", detail: auth.rawSummary });
  if (auth.resource && auth.resource.accounts.length > 1 && !accountId) {
    checks.push({ id: "account-selection", status: "blocked", detail: "Multiple accounts require explicit --account-id." });
  } else {
    checks.push({ id: "account-selection", status: accountId ? "pass" : "action-required", detail: accountId ? `account=${accountId}` : "No account ID selected." });
  }
  const permissions = accountId ? await adapter.getPermissions(accountId) : undefined;
  if (permissions) {
    checks.push({
      id: "account-permissions",
      status: permissions.status === "pass" ? "pass" : "action-required",
      detail: `${permissions.status}: ${permissions.rawSummary}${permissions.warnings.length ? `; ${permissions.warnings.join("; ")}` : ""}`,
    });
  }

  const [workers, d1, r2, secrets] = await Promise.all([
    adapter.listWorkers(accountId),
    adapter.listD1Databases(accountId),
    adapter.listR2Buckets(accountId),
    adapter.listWorkerSecrets(accountId, config.workerName),
  ]);
  checks.push(...remoteReadChecks({ workers, d1, r2, secrets }));

  const workerOwnership = workers.ok
    ? determineOwnership({ desiredName: config.workerName, accountId, explicitReuse: options.reuseWorker, matches: workers.resource ?? [] })
    : "inaccessible";
  const d1Matches = (d1.resource ?? []).filter((db) => db.name === config.d1DatabaseName || db.id === config.d1DatabaseId);
  const r2Matches = (r2.resource ?? []).filter((bucket) => bucket.name === config.r2BucketName);
  const d1Ownership = d1.ok
    ? determineOwnership({ desiredName: config.d1DatabaseName, desiredId: config.d1DatabaseId, accountId, explicitReuse: options.reuseD1, matches: d1Matches })
    : "inaccessible";
  const r2Ownership = r2.ok
    ? determineOwnership({ desiredName: config.r2BucketName, accountId, explicitReuse: options.reuseR2, matches: r2Matches })
    : "inaccessible";
  const workerExists = workerOwnership === "owned" || workerOwnership === "explicitly-reused";
  const d1Exists = d1Ownership === "owned" || d1Ownership === "explicitly-reused";
  const r2Exists = r2Ownership === "owned" || r2Ownership === "explicitly-reused";
  const secretOwnership = secrets.ok ? workerOwnership : "inaccessible";

  const operations = [
    createOperationPlan({
      stepId: "worker",
      accountId,
      resourceType: "worker",
      resourceName: config.workerName,
      action: workers.ok ? (workerExists ? "prepare-worker-reuse" : "prepare-worker") : "remote-state-unverified",
      riskLevel: 3,
      ownership: workerOwnership,
      requiredAllowFlags: [],
      previousState: remoteStateSummary(workers),
      resultingState: "worker-prepared-for-phase4-deploy",
    }),
    createOperationPlan({
      stepId: "config-patch",
      accountId,
      resourceType: "local-config",
      resourceName: "wrangler.jsonc + starter.site.json",
      action: "patch-production-config",
      riskLevel: 2,
      ownership: "owned",
      requiredAllowFlags: ["allowConfigPatch"],
      previousState: `wrangler=${localConfigHashes.wrangler}; starter=${localConfigHashes.starter}`,
      resultingState: "production-config-patched",
    }),
    createOperationPlan({
      stepId: "d1",
      accountId,
      resourceType: "d1",
      resourceName: config.d1DatabaseName,
      resourceId: d1Matches[0]?.id,
      action: d1.ok ? (d1Exists ? "reuse-d1" : "create-d1") : "remote-state-unverified",
      riskLevel: 3,
      ownership: d1Ownership,
      requiredAllowFlags: d1Exists ? [] : ["allowCreateD1"],
      previousState: remoteStateSummary(d1),
      resultingState: "d1-confirmed",
    }),
    createOperationPlan({
      stepId: "r2",
      accountId,
      resourceType: "r2",
      resourceName: config.r2BucketName,
      action: r2.ok ? (r2Exists ? "reuse-r2" : "create-r2") : "remote-state-unverified",
      riskLevel: 3,
      ownership: r2Ownership,
      requiredAllowFlags: r2Exists ? [] : ["allowCreateR2"],
      previousState: remoteStateSummary(r2),
      resultingState: "r2-confirmed",
    }),
    createOperationPlan({
      stepId: "secrets",
      accountId,
      resourceType: "secret",
      resourceName: config.workerName,
      action: "put-required-secrets",
      riskLevel: 3,
      ownership: secretOwnership,
      requiredAllowFlags: ["allowSetSecrets"],
      previousState: secrets.ok ? secrets.resource?.map((secret) => `${secret.name}:${secret.status}`).join(",") || "none-configured" : remoteStateSummary(secrets),
      resultingState: "secret-names-configured",
    }),
    createOperationPlan({
      stepId: "build",
      accountId,
      resourceType: "deploy",
      resourceName: config.workerName,
      action: "build-deployment-artifact",
      riskLevel: 2,
      ownership: "owned",
      requiredAllowFlags: [],
      previousState: "not-built",
      resultingState: "artifact-validated",
    }),
    createOperationPlan({
      stepId: "deploy",
      accountId,
      resourceType: "deploy",
      resourceName: config.workerName,
      action: "deploy-worker",
      riskLevel: 3,
      ownership: "owned",
      requiredAllowFlags: ["allowDeploy"],
      previousState: workerOwnership,
      resultingState: "worker-deployed-and-verified",
    }),
    createOperationPlan({
      stepId: "d1-schema",
      accountId,
      resourceType: "d1",
      resourceName: config.d1DatabaseName,
      resourceId: d1Matches[0]?.id,
      action: "execute-d1-schema",
      riskLevel: 3,
      ownership: d1Ownership,
      requiredAllowFlags: ["allowD1Write"],
      previousState: "schema-state-unknown",
      resultingState: "schema-verified",
    }),
    createOperationPlan({
      stepId: "d1-seed",
      accountId,
      resourceType: "d1",
      resourceName: config.d1DatabaseName,
      resourceId: d1Matches[0]?.id,
      action: "execute-bootstrap-seed",
      riskLevel: 3,
      ownership: d1Ownership,
      requiredAllowFlags: ["allowD1Write", "allowBootstrapSeed"],
      previousState: "seed-state-unknown",
      resultingState: "seed-verified",
    }),
    createOperationPlan({
      stepId: "r2-probe",
      accountId,
      resourceType: "r2",
      resourceName: config.r2BucketName,
      action: "probe-r2-upload-read-delete",
      riskLevel: 3,
      ownership: r2Ownership,
      requiredAllowFlags: ["allowR2Probe"],
      previousState: "probe-object-absent-required",
      resultingState: "r2-probe-verified",
    }),
    createOperationPlan({
      stepId: "domain",
      accountId,
      resourceType: "domain",
      resourceName: config.customDomain,
      action: "bind-domain-and-www-redirect",
      riskLevel: 4,
      ownership: "missing",
      requiredAllowFlags: ["allowDomainChange"],
      previousState: "unknown",
      resultingState: "domain-verified",
    }),
  ];
  const planHash = hashWorkflowPlan(operations, { accountId, adapter: options.adapterMode, wranglerVersion, config: { workerName: config.workerName, d1DatabaseName: config.d1DatabaseName, d1DatabaseId: config.d1DatabaseId, r2BucketName: config.r2BucketName, siteUrl: config.siteUrl, r2PublicBaseUrl: config.r2PublicBaseUrl }, localConfigHashes, permissions: permissions ? remoteStateSummary(permissions) : "not-checked", reads: [remoteStateSummary(workers), remoteStateSummary(d1), remoteStateSummary(r2), remoteStateSummary(secrets)] });

  if (mode !== "execute") {
    return {
      mode,
      adapter: options.adapterMode,
      wranglerVersion,
      riskLevel: mode === "remote-check" ? 1 : 0,
      accountId,
      summary: checks.some((check) => check.status === "blocked") ? "blocked" : "action-required",
      planHash,
      checks: [
        ...checks,
        { id: "read-only", status: "pass", detail: "No Worker, D1, R2, secret, deploy, domain, or DNS writes were executed." },
        { id: "r2-probe", status: "skip", detail: "Read-only mode does not execute upload/read/delete probe." },
      ],
      operations,
      remoteCalls: [...adapter.callLog],
    };
  }

  if (!options.approvedPlanHash || options.approvedPlanHash !== planHash) {
    return {
      mode,
      adapter: options.adapterMode,
      wranglerVersion,
      riskLevel: Math.max(...operations.map((operation) => operation.riskLevel)),
      accountId,
      summary: "blocked",
      planHash,
      checks: [
        ...checks,
        {
          id: "approved-plan-hash",
          status: "blocked",
          detail: options.approvedPlanHash ? "Approved plan hash does not match the current remote state." : "Execute requires --approved-plan-hash from the current remote plan.",
        },
      ],
      operations,
      remoteCalls: [...adapter.callLog],
    };
  }

  const resumeState = loadResumeState(planHash, options);
  if (!resumeState.ok) {
    const writeAuthorization = evaluateFullWritePreflight({ operations, options, completedSteps: new Set() });
    const executionReportPath = writeExecutionReport({ config, options, wranglerVersion, planHash, operations, executionSteps: [], summary: "blocked", writeAuthorization });
    return {
      mode,
      adapter: options.adapterMode,
      wranglerVersion,
      riskLevel: Math.max(...operations.map((operation) => operation.riskLevel)),
      accountId,
      summary: "blocked",
      planHash,
      checks: [
        ...checks,
        { id: "resume", status: "blocked", detail: `${resumeState.code}: ${resumeState.message}` },
        { id: "execution-report", status: "pass", detail: executionReportPath },
      ],
      operations,
      remoteCalls: [...adapter.callLog],
      executionReportPath,
    };
  }
  const completedSteps = resumeState.completedSteps;
  const writeAuthorization = evaluateFullWritePreflight({ operations, options, completedSteps });
  const blockedWrites = writeAuthorization.filter((decision) => decision.planned && !decision.authorized);
  if (blockedWrites.length > 0) {
    const executionReportPath = writeExecutionReport({ config, options, wranglerVersion, planHash, operations, executionSteps: [], summary: "blocked", writeAuthorization });
    return {
      mode,
      adapter: options.adapterMode,
      wranglerVersion,
      riskLevel: Math.max(...operations.map((operation) => operation.riskLevel)),
      accountId,
      summary: "blocked",
      planHash,
      checks: [
        ...checks,
        {
          id: "full-write-preflight",
          status: "blocked",
          detail: blockedWrites.map((decision) => `${decision.stepId}: ${decision.reason}`).join("; "),
        },
        { id: "execution-report", status: "pass", detail: executionReportPath },
      ],
      operations,
      remoteCalls: [...adapter.callLog],
      executionReportPath,
    };
  }
  const productionResourceAuthorization = evaluateProductionResourceAuthorization({
    config,
    options,
    operations,
    planHash,
    writeAuthorization,
    commandName: "production:setup",
    gitCleanOverride: options.adapterMode === "mock" && process.env.CONTENTFORGE_TEST_ASSUME_GIT_CLEAN === "1" ? true : undefined,
  });
  if (!productionResourceAuthorization.authorized) {
    const executionReportPath = writeExecutionReport({ config, options, wranglerVersion, planHash, operations, executionSteps: [], summary: "blocked", writeAuthorization, productionResourceAuthorization });
    return {
      mode,
      adapter: options.adapterMode,
      wranglerVersion,
      riskLevel: Math.max(...operations.map((operation) => operation.riskLevel)),
      accountId,
      summary: "blocked",
      planHash,
      checks: [
        ...checks,
        {
          id: "production-resource-authorization",
          status: "blocked",
          detail: productionResourceAuthorization.checks.filter((check) => check.status === "blocked").map((check) => `${check.errorCode}: ${check.detail}`).join("; "),
        },
        { id: "execution-report", status: "pass", detail: executionReportPath },
      ],
      operations,
      remoteCalls: [...adapter.callLog],
      executionReportPath,
    };
  }
  const productionAuthorizationEvidence = productionResourceAuthorization.evidence;

  const lock = acquireProductionLock({
    operationId: operations[0]?.operationId ?? "cloudflare-execution",
    mode,
    riskLevel: 3,
    targetSummary: operations.map((operation) => operation.targetSummary).join(", "),
  });
  const executionSteps: ExecutionStepResult[] = [];
  try {
    const unfinished = findUnfinishedProductionPatches();
    if (unfinished.length > 0) {
      const operation = operations.find((item) => item.stepId === "config-patch") ?? operations[0];
      if (operation) executionSteps.push(recordSkippedOrBlocked({ operation, accountId, mode, options, planHash, outcome: "blocked", errorCode: "PATCH_RECOVERY_REQUIRED", evidence: `Unfinished config patch journal exists: ${unfinished[0]?.operationId}. Run --recover-config-patch --operation-id=${unfinished[0]?.operationId}` }));
      const executionReportPath = writeExecutionReport({ config, options, wranglerVersion, planHash, operations, executionSteps, summary: "blocked" });
      return failedExecutionReport({ mode, adapter, wranglerVersion, riskLevel: 3, accountId, planHash, checks, operations, executionSteps, executionReportPath });
    }

    const workerOperation = operations.find((operation) => operation.stepId === "worker");
    if (workerOperation?.action === "remote-state-unverified") {
      executionSteps.push(recordSkippedOrBlocked({ operation: workerOperation, accountId, mode, options, planHash, outcome: "skipped", errorCode: "WORKER_REMOTE_STATE_UNVERIFIED", evidence: "Worker remote state is not verified; config patch may prepare local Worker name but must not mark Worker created." }));
    }

    const d1Operation = operations.find((operation) => operation.stepId === "d1");
    let verifiedD1: D1Resource | undefined = d1Matches[0];
    let configPatchResult: ConfigPatchResult | undefined;
    if (d1Operation) {
      if (completedSteps.has("d1")) {
        executionSteps.push(recordSkippedOrBlocked({ operation: d1Operation, accountId, mode, options, planHash, outcome: "skipped", evidence: "Resume skipped previously verified D1 step." }));
      } else {
      const result = await executeD1CreateOrConfirm({ adapter, operation: d1Operation, accountId, config, mode, options, planHash, productionAuthorizationEvidence });
      executionSteps.push(result.step);
      verifiedD1 = result.resource ?? verifiedD1;
      if (!result.ok) {
        const executionReportPath = writeExecutionReport({ config, options, wranglerVersion, planHash, operations, executionSteps, summary: "failed" });
        return failedExecutionReport({ mode, adapter, wranglerVersion, riskLevel: 3, accountId, planHash, checks, operations, executionSteps, executionReportPath });
      }
      }
    }

    const r2Operation = operations.find((operation) => operation.stepId === "r2");
    let verifiedR2: R2Resource | undefined = r2Matches[0];
    if (r2Operation) {
      if (completedSteps.has("r2")) {
        executionSteps.push(recordSkippedOrBlocked({ operation: r2Operation, accountId, mode, options, planHash, outcome: "skipped", evidence: "Resume skipped previously verified R2 step." }));
      } else {
      const result = await executeR2CreateOrConfirm({ adapter, operation: r2Operation, accountId, config, mode, options, planHash, productionAuthorizationEvidence });
      executionSteps.push(result.step);
      verifiedR2 = result.resource ?? verifiedR2;
      if (!result.ok) {
        const executionReportPath = writeExecutionReport({ config, options, wranglerVersion, planHash, operations, executionSteps, summary: "failed" });
        return failedExecutionReport({ mode, adapter, wranglerVersion, riskLevel: 3, accountId, planHash, checks, operations, executionSteps, executionReportPath });
      }
      }
    }
    const configOperation = operations.find((operation) => operation.stepId === "config-patch");
    if (configOperation) {
      if (!options.allowFlags.allowConfigPatch) {
        executionSteps.push(recordSkippedOrBlocked({ operation: configOperation, accountId, mode, options, planHash, outcome: "blocked", errorCode: "MISSING_ALLOW_CONFIG_PATCH", evidence: "Config patch requires --allow-config-patch." }));
        const executionReportPath = writeExecutionReport({ config, options, wranglerVersion, planHash, operations, executionSteps, summary: "blocked" });
        return failedExecutionReport({ mode, adapter, wranglerVersion, riskLevel: 3, accountId, planHash, checks, operations, executionSteps, executionReportPath });
      }
      if (!verifiedD1?.id || !verifiedR2?.name) {
        executionSteps.push(recordSkippedOrBlocked({ operation: configOperation, accountId, mode, options, planHash, outcome: "failed", errorCode: "PATCH_INPUT_UNVERIFIED", evidence: "Verified D1/R2 results are required before config patch." }));
        const executionReportPath = writeExecutionReport({ config, options, wranglerVersion, planHash, operations, executionSteps, summary: "failed" });
        return failedExecutionReport({ mode, adapter, wranglerVersion, riskLevel: 3, accountId, planHash, checks, operations, executionSteps, executionReportPath });
      }
      const startedAt = new Date();
      const patchResult = patchProductionConfig({
        operationId: configOperation.operationId,
        executionPlanHash: planHash,
        accountId,
        adapter: options.adapterMode,
        workerName: config.workerName,
        d1DatabaseName: verifiedD1.name,
        d1DatabaseId: verifiedD1.id,
        r2BucketName: verifiedR2.name,
        siteUrl: config.siteUrl,
        r2PublicBaseUrl: config.r2PublicBaseUrl,
      });
      configPatchResult = patchResult;
      executionSteps.push(recordConfigPatchResult({ operation: configOperation, accountId, mode, options, planHash, startedAt, result: patchResult }));
      if (!patchResult.ok) {
        const executionReportPath = writeExecutionReport({ config, options, wranglerVersion, planHash, operations, executionSteps, summary: "failed", configPatch: patchResult });
        return failedExecutionReport({ mode, adapter, wranglerVersion, riskLevel: 3, accountId, planHash, checks, operations, executionSteps, executionReportPath });
      }
    }
    const buildOperation = operations.find((operation) => operation.stepId === "build");
    if (buildOperation) {
      if (completedSteps.has("build")) {
        executionSteps.push(recordSkippedOrBlocked({ operation: buildOperation, accountId, mode, options, planHash, outcome: "skipped", evidence: "Resume skipped previously verified build step." }));
      } else {
      const startedAt = new Date();
      const build = await buildProductionArtifact({ adapterMode: options.adapterMode });
      executionSteps.push(recordPhase4Result({ operation: buildOperation, accountId, mode, options, planHash, startedAt, result: build }));
      if (!build.ok) {
        const executionReportPath = writeExecutionReport({ config, options, wranglerVersion, planHash, operations, executionSteps, summary: "failed", configPatch: configPatchResult });
        return failedExecutionReport({ mode, adapter, wranglerVersion, riskLevel: 3, accountId, planHash, checks, operations, executionSteps, executionReportPath });
      }
      }
    }

    const deployOperation = operations.find((operation) => operation.stepId === "deploy");
    let deployedWorker = false;
    if (deployOperation) {
      if (completedSteps.has("deploy")) {
        executionSteps.push(recordSkippedOrBlocked({ operation: deployOperation, accountId, mode, options, planHash, outcome: "skipped", evidence: "Resume skipped previously verified deploy step." }));
        deployedWorker = true;
      } else {
      if (!options.allowFlags.allowDeploy) {
        executionSteps.push(recordSkippedOrBlocked({ operation: deployOperation, accountId, mode, options, planHash, outcome: "blocked", errorCode: "DEPLOY_NOT_AUTHORIZED", evidence: "Deploy requires --allow-deploy." }));
        const executionReportPath = writeExecutionReport({ config, options, wranglerVersion, planHash, operations, executionSteps, summary: "blocked", configPatch: configPatchResult });
        return failedExecutionReport({ mode, adapter, wranglerVersion, riskLevel: 3, accountId, planHash, checks, operations, executionSteps, executionReportPath });
      }
      const startedAt = new Date();
      const deploy = await adapter.deployWorker(accountId, config.workerName, productionAuthorizationEvidence);
      executionSteps.push(recordAdapterResult({ operation: deployOperation, accountId, mode, options, planHash, startedAt, result: deploy }));
      if (!deploy.ok || deploy.resource?.name !== config.workerName) {
        const executionReportPath = writeExecutionReport({ config, options, wranglerVersion, planHash, operations, executionSteps, summary: "failed", configPatch: configPatchResult });
        return failedExecutionReport({ mode, adapter, wranglerVersion, riskLevel: 3, accountId, planHash, checks, operations, executionSteps, executionReportPath });
      }
      deployedWorker = true;
      }
    }

    const secretsOperation = operations.find((operation) => operation.stepId === "secrets");
    if (secretsOperation) {
      if (completedSteps.has("secrets")) {
        executionSteps.push(recordSkippedOrBlocked({ operation: secretsOperation, accountId, mode, options, planHash, outcome: "skipped", evidence: "Resume skipped previously successful secret command records." }));
      } else {
      if (!options.allowFlags.allowSetSecrets) {
        executionSteps.push(recordSkippedOrBlocked({ operation: secretsOperation, accountId, mode, options, planHash, outcome: "blocked", errorCode: "SECRET_WRITE_NOT_AUTHORIZED", evidence: "Secret write requires --allow-set-secrets or --allow-secret-write." }));
        const executionReportPath = writeExecutionReport({ config, options, wranglerVersion, planHash, operations, executionSteps, summary: deployedWorker ? "failed" : "blocked", configPatch: configPatchResult });
        return failedExecutionReport({ mode, adapter, wranglerVersion, riskLevel: 3, accountId, planHash, checks, operations, executionSteps, executionReportPath });
      }
      const secretPreflight = preflightSecrets();
      if (!secretPreflight.ok || !secretPreflight.resource) {
        executionSteps.push(recordPhase4Result({ operation: secretsOperation, accountId, mode, options, planHash, startedAt: new Date(), result: secretPreflight }));
        const executionReportPath = writeExecutionReport({ config, options, wranglerVersion, planHash, operations, executionSteps, summary: "failed", configPatch: configPatchResult });
        return failedExecutionReport({ mode, adapter, wranglerVersion, riskLevel: 3, accountId, planHash, checks, operations, executionSteps, executionReportPath });
      }
      const adminStartedAt = new Date();
      const admin = await adapter.putWorkerSecret(accountId, config.workerName, "ADMIN_PASSWORD", secretPreflight.resource.adminPassword, productionAuthorizationEvidence);
      executionSteps.push(recordAdapterResult({ operation: secretsOperation, accountId, mode, options, planHash, startedAt: adminStartedAt, result: admin }));
      if (!admin.ok) {
        const executionReportPath = writeExecutionReport({ config, options, wranglerVersion, planHash, operations, executionSteps, summary: "failed", configPatch: configPatchResult });
        return failedExecutionReport({ mode, adapter, wranglerVersion, riskLevel: 3, accountId, planHash, checks, operations, executionSteps, executionReportPath });
      }
      const sessionStartedAt = new Date();
      const session = await adapter.putWorkerSecret(accountId, config.workerName, "SESSION_SECRET", secretPreflight.resource.sessionSecret ?? generateSessionSecret(), productionAuthorizationEvidence);
      executionSteps.push(recordAdapterResult({ operation: secretsOperation, accountId, mode, options, planHash, startedAt: sessionStartedAt, result: session }));
      if (!session.ok) {
        const executionReportPath = writeExecutionReport({ config, options, wranglerVersion, planHash, operations, executionSteps, summary: "failed", configPatch: configPatchResult });
        return failedExecutionReport({ mode, adapter, wranglerVersion, riskLevel: 3, accountId, planHash, checks, operations, executionSteps, executionReportPath });
      }
      }
    }

    const schemaOperation = operations.find((operation) => operation.stepId === "d1-schema");
    const seedOperation = operations.find((operation) => operation.stepId === "d1-seed");
    let schemaExecuted = false;
    let seedExecuted = false;
    let seedHash: string | undefined;
    if (schemaOperation || seedOperation) {
      const needsSchemaWrite = Boolean(schemaOperation && !completedSteps.has("d1-schema"));
      const needsSeedWrite = Boolean(seedOperation && !completedSteps.has("d1-seed"));
      const needsD1Write = needsSchemaWrite || needsSeedWrite;

      if (schemaOperation && completedSteps.has("d1-schema")) {
        executionSteps.push(
          recordSkippedOrBlocked({
            operation: schemaOperation,
            accountId,
            mode,
            options,
            planHash,
            outcome: "skipped",
            evidence: "Resume skipped previously verified D1 schema step.",
          }),
        );
        schemaExecuted = true;
      }

      if (needsD1Write && !options.allowFlags.allowD1Write) {
        executionSteps.push(
          recordSkippedOrBlocked({
            operation: needsSchemaWrite ? schemaOperation! : seedOperation!,
            accountId,
            mode,
            options,
            planHash,
            outcome: "blocked",
            errorCode: "D1_WRITE_NOT_AUTHORIZED",
            evidence: "D1 schema or seed requires --allow-d1-write or --allow-d1-execute.",
          }),
        );
        const executionReportPath = writeExecutionReport({ config, options, wranglerVersion, planHash, operations, executionSteps, summary: "blocked", configPatch: configPatchResult });
        return failedExecutionReport({ mode, adapter, wranglerVersion, riskLevel: 3, accountId, planHash, checks, operations, executionSteps, executionReportPath });
      }

      const sources = resolveD1SqlSources({ allowBootstrapSeed: options.allowFlags.allowBootstrapSeed });
      const safeSources = sources.resource ? verifySafeSqlSources(sources.resource) : sources;
      if (!sources.ok || !sources.resource || !safeSources.ok) {
        executionSteps.push(recordPhase4Result({ operation: schemaOperation ?? seedOperation!, accountId, mode, options, planHash, startedAt: new Date(), result: safeSources.ok ? sources : safeSources }));
        const executionReportPath = writeExecutionReport({ config, options, wranglerVersion, planHash, operations, executionSteps, summary: "failed", configPatch: configPatchResult });
        return failedExecutionReport({ mode, adapter, wranglerVersion, riskLevel: 3, accountId, planHash, checks, operations, executionSteps, executionReportPath });
      }

      const schemaSource = sources.resource.find((source) => source.purpose === "schema");
      if (schemaOperation && !completedSteps.has("d1-schema") && schemaSource) {
        const startedAt = new Date();
        const schema = await adapter.executeD1(accountId, verifiedD1?.id ?? config.d1DatabaseId, schemaSource.sql, productionAuthorizationEvidence);
        executionSteps.push(recordD1SourceResult({ operation: schemaOperation, accountId, mode, options, planHash, startedAt, result: schema, source: schemaSource }));
        if (!schema.ok) {
          const executionReportPath = writeExecutionReport({ config, options, wranglerVersion, planHash, operations, executionSteps, summary: "failed", configPatch: configPatchResult });
          return failedExecutionReport({ mode, adapter, wranglerVersion, riskLevel: 3, accountId, planHash, checks, operations, executionSteps, executionReportPath });
        }
        schemaExecuted = true;
      }

      const seedSource = sources.resource.find((source) => source.purpose === "seed");
      if (seedOperation && completedSteps.has("d1-seed")) {
        executionSteps.push(
          recordSkippedOrBlocked({
            operation: seedOperation,
            accountId,
            mode,
            options,
            planHash,
            outcome: "skipped",
            evidence: "Resume skipped previously verified D1 seed step.",
          }),
        );
        seedExecuted = true;
        seedHash = seedSource?.hash;
      } else if (seedOperation && seedSource) {
        const startedAt = new Date();
        const seed = await adapter.executeD1(accountId, verifiedD1?.id ?? config.d1DatabaseId, seedSource.sql, productionAuthorizationEvidence);
        executionSteps.push(recordD1SourceResult({ operation: seedOperation, accountId, mode, options, planHash, startedAt, result: seed, source: seedSource }));
        if (!seed.ok) {
          const executionReportPath = writeExecutionReport({ config, options, wranglerVersion, planHash, operations, executionSteps, summary: "failed", configPatch: configPatchResult });
          return failedExecutionReport({ mode, adapter, wranglerVersion, riskLevel: 3, accountId, planHash, checks, operations, executionSteps, executionReportPath });
        }
        seedExecuted = true;
        seedHash = seedSource.hash;
      } else if (seedOperation) {
        executionSteps.push(recordSkippedOrBlocked({ operation: seedOperation, accountId, mode, options, planHash, outcome: "skipped", errorCode: "BOOTSTRAP_SEED_NOT_AUTHORIZED", evidence: "Bootstrap seed requires --allow-bootstrap-seed and a controlled seed source." }));
      }

      const verification = verifyD1PostWrite({ schemaExecuted, seedExecuted, seedHash });
      if (!verification.ok) {
        executionSteps.push(recordPhase4Result({ operation: schemaOperation ?? seedOperation!, accountId, mode, options, planHash, startedAt: new Date(), result: verification }));
        const executionReportPath = writeExecutionReport({ config, options, wranglerVersion, planHash, operations, executionSteps, summary: "failed", configPatch: configPatchResult });
        return failedExecutionReport({ mode, adapter, wranglerVersion, riskLevel: 3, accountId, planHash, checks, operations, executionSteps, executionReportPath });
      }
    }

    const r2ProbeOperation = operations.find((operation) => operation.stepId === "r2-probe");
    if (r2ProbeOperation) {
      if (completedSteps.has("r2-probe")) {
        executionSteps.push(recordSkippedOrBlocked({ operation: r2ProbeOperation, accountId, mode, options, planHash, outcome: "skipped", evidence: "Resume skipped previously verified R2 probe step." }));
      } else if (!options.allowFlags.allowR2Probe) {
        executionSteps.push(recordSkippedOrBlocked({ operation: r2ProbeOperation, accountId, mode, options, planHash, outcome: "blocked", errorCode: "R2_PROBE_NOT_AUTHORIZED", evidence: "R2 probe requires --allow-r2-probe." }));
        const executionReportPath = writeExecutionReport({ config, options, wranglerVersion, planHash, operations, executionSteps, summary: "blocked", configPatch: configPatchResult });
        return failedExecutionReport({ mode, adapter, wranglerVersion, riskLevel: 3, accountId, planHash, checks, operations, executionSteps, executionReportPath });
      } else if (!verifiedR2?.name) {
        executionSteps.push(recordSkippedOrBlocked({ operation: r2ProbeOperation, accountId, mode, options, planHash, outcome: "failed", errorCode: "R2_PROBE_BUCKET_UNVERIFIED", evidence: "Verified R2 bucket is required before probe." }));
        const executionReportPath = writeExecutionReport({ config, options, wranglerVersion, planHash, operations, executionSteps, summary: "failed", configPatch: configPatchResult });
        return failedExecutionReport({ mode, adapter, wranglerVersion, riskLevel: 3, accountId, planHash, checks, operations, executionSteps, executionReportPath });
      } else {
        const probe = await executeR2Probe({ adapter, operation: r2ProbeOperation, accountId, bucketName: verifiedR2.name, mode, options, planHash, productionAuthorizationEvidence });
        executionSteps.push(...probe.steps);
        if (!probe.ok) {
          const executionReportPath = writeExecutionReport({ config, options, wranglerVersion, planHash, operations, executionSteps, summary: "failed", configPatch: configPatchResult });
          return failedExecutionReport({ mode, adapter, wranglerVersion, riskLevel: 3, accountId, planHash, checks, operations, executionSteps, executionReportPath });
        }
      }
    }

    const executionReportPath = writeExecutionReport({ config, options, wranglerVersion, planHash, operations, executionSteps, summary: "passed", configPatch: configPatchResult, productionResourceAuthorization });
    return {
      mode,
      adapter: options.adapterMode,
      wranglerVersion,
      riskLevel: 3,
      accountId,
      summary: "passed",
      planHash,
      checks: [
        ...checks,
        { id: "execute", status: "pass", detail: "Phase 4 build, deploy, secrets, and D1 initialization completed through controlled workflow." },
        { id: "r2-probe", status: "pass", detail: "R2 probe upload/read/delete/not-found verification completed when authorized." },
        { id: "domain", status: "skip", detail: "Phase 2 does not change Domain/DNS." },
        { id: "execution-report", status: "pass", detail: executionReportPath },
      ],
      operations,
      remoteCalls: [...adapter.callLog],
      executionReportPath,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown execution error.";
    const operation = operations.find((item) => item.stepId === "d1" || item.stepId === "r2") ?? operations[0];
    if (operation) {
      executionSteps.push(recordSkippedOrBlocked({ operation, accountId, mode, options, planHash, outcome: "failed", errorCode: "EXECUTION_EXCEPTION", evidence: message }));
    }
    const executionReportPath = writeExecutionReport({ config, options, wranglerVersion, planHash, operations, executionSteps, summary: "failed" });
    return failedExecutionReport({ mode, adapter, wranglerVersion, riskLevel: 3, accountId, planHash, checks, operations, executionSteps, executionReportPath });
  } finally {
    releaseProductionLock(lock.operationId);
  }
}

function hashWorkflowPlan(operations: OperationPlan[], context: Record<string, unknown>) {
  return crypto.createHash("sha256").update(stableJson({ context, operations: operations.map((operation) => operation.planHash) })).digest("hex");
}

export function evaluateFullWritePreflight(input: {
  operations: OperationPlan[];
  options: RemoteExecutionOptions;
  completedSteps?: Set<string>;
}): WriteAuthorizationDecision[] {
  const completedSteps = input.completedSteps ?? new Set<string>();
  return input.operations.map((operation) => {
    const requiredFlags = requiredWriteFlags(operation);
    const planned = isPlannedWriteStep(operation, completedSteps);
    if (!planned) {
      return {
        stepId: operation.stepId,
        planned,
        requiredFlags,
        authorized: true,
        reason: completedSteps.has(operation.stepId) ? "Step is verified by matching resume state and will not be re-executed." : "Step is not part of the default write loop.",
      };
    }
    if (!input.options.accountId && operation.riskLevel >= 1) {
      return { stepId: operation.stepId, planned, requiredFlags, authorized: false, reason: "Remote write step requires --account-id." };
    }
    if ((operation.stepId === "d1" || operation.stepId === "r2") && ["ambiguous", "foreign", "inaccessible"].includes(operation.ownership)) {
      return { stepId: operation.stepId, planned, requiredFlags, authorized: false, reason: `Resource ownership is ${operation.ownership}.` };
    }
    const missing = requiredFlags.filter((flag) => !input.options.allowFlags[flag]);
    if (missing.length > 0) {
      return { stepId: operation.stepId, planned, requiredFlags, authorized: false, reason: `Missing allow flag(s): ${missing.join(", ")}` };
    }
    return { stepId: operation.stepId, planned, requiredFlags, authorized: true, reason: requiredFlags.length ? "All required allow flags are present." : "No allow flag is required for this planned step." };
  });
}

function isPlannedWriteStep(operation: OperationPlan, completedSteps: Set<string>) {
  if (completedSteps.has(operation.stepId)) return false;
  if (operation.stepId === "domain") return false;
  if (operation.stepId === "d1-seed" && !seedSourceExists()) return false;
  return ["d1", "r2", "config-patch", "build", "deploy", "secrets", "d1-schema", "d1-seed", "r2-probe"].includes(operation.stepId);
}

function requiredWriteFlags(operation: OperationPlan): Array<keyof RemoteExecutionOptions["allowFlags"]> {
  if (operation.stepId === "build") return ["allowDeploy"];
  if (operation.stepId === "d1-seed" && !seedSourceExists()) return [];
  return [...operation.requiredAllowFlags];
}

function seedSourceExists() {
  return existsSync(path.join(projectRoot, "data", "d1-seed.sql"));
}

export function renderControlledWorkflowReport(report: ControlledWorkflowReport) {
  const lines = [
    "Controlled Cloudflare Execution",
    `Mode: ${report.mode}`,
    `Adapter: ${report.adapter}`,
    `Wrangler: ${report.wranglerVersion}`,
    `Risk level: ${report.riskLevel}`,
    `Account: ${report.accountId || "not-selected"}`,
    `Plan hash: ${report.planHash}`,
    `Summary: ${report.summary}`,
    "Checks:",
    ...report.checks.map((check) => `- ${check.status} ${check.id}: ${check.detail}`),
    "Operations:",
    ...report.operations.map((operation) => `- ${operation.stepId} ${operation.action} ${operation.targetSummary} risk=${operation.riskLevel} plan=${operation.planHash}`),
  ];
  return lines.join("\n");
}

function remoteReadChecks(input: {
  workers: { ok: boolean; status: string; rawSummary: string; errorCode?: string };
  d1: { ok: boolean; status: string; rawSummary: string; errorCode?: string; resource?: unknown[] };
  r2: { ok: boolean; status: string; rawSummary: string; errorCode?: string; resource?: unknown[] };
  secrets: { ok: boolean; status: string; rawSummary: string; errorCode?: string };
}): ControlledWorkflowReport["checks"] {
  return [
    { id: "worker-read", status: input.workers.ok ? "pass" : "action-required", detail: remoteStateSummary(input.workers) },
    { id: "d1-read", status: input.d1.ok ? "pass" : "action-required", detail: remoteStateSummary(input.d1) },
    { id: "r2-read", status: input.r2.ok ? "pass" : "action-required", detail: remoteStateSummary(input.r2) },
    { id: "secret-read", status: input.secrets.ok ? "pass" : "action-required", detail: remoteStateSummary(input.secrets) },
  ];
}

function remoteStateSummary(result: { ok: boolean; status: string; rawSummary: string; errorCode?: string; resource?: unknown }) {
  const count = Array.isArray(result.resource) ? ` count=${result.resource.length}` : "";
  return `${result.ok ? "verified" : result.status}${result.errorCode ? ` ${result.errorCode}` : ""}${count}: ${result.rawSummary}`;
}

async function executeD1CreateOrConfirm(input: {
  adapter: ControlledCloudflareAdapter;
  operation: OperationPlan;
  accountId: string;
  config: BootstrapConfigInput;
  mode: ControlledWorkflowReport["mode"];
  options: RemoteExecutionOptions;
  planHash: string;
  productionAuthorizationEvidence?: ProductionAuthorizationEvidence;
}): Promise<{ ok: boolean; step: ExecutionStepResult; resource?: D1Resource }> {
  if (input.operation.action === "reuse-d1") {
    return { ok: true, step: recordSkippedOrBlocked({ ...input, outcome: "success", evidence: "D1 already verified for reuse." }) };
  }
  const startedAt = new Date();
  const result = await input.adapter.createD1Database(input.accountId, input.config.d1DatabaseName, input.productionAuthorizationEvidence);
  if (!result.ok) return { ok: false, step: recordAdapterResult({ ...input, startedAt, result }) };
  const reread = await input.adapter.listD1Databases(input.accountId);
  const verified = verifyD1(reread, result.resource);
  if (!verified.ok) {
    return {
      ok: false,
      step: recordAdapterResult({
        ...input,
        startedAt,
        result: {
          ok: false,
          status: verified.status,
          rawSummary: verified.message,
          warnings: [],
          errorCode: verified.code,
          errorMessage: verified.message,
          retryable: true,
        },
      }),
    };
  }
  return { ok: true, step: recordAdapterResult({ ...input, startedAt, result }), resource: result.resource };
}

async function executeR2CreateOrConfirm(input: {
  adapter: ControlledCloudflareAdapter;
  operation: OperationPlan;
  accountId: string;
  config: BootstrapConfigInput;
  mode: ControlledWorkflowReport["mode"];
  options: RemoteExecutionOptions;
  planHash: string;
  productionAuthorizationEvidence?: ProductionAuthorizationEvidence;
}): Promise<{ ok: boolean; step: ExecutionStepResult; resource?: R2Resource }> {
  if (input.operation.action === "reuse-r2") {
    return { ok: true, step: recordSkippedOrBlocked({ ...input, outcome: "success", evidence: "R2 already verified for reuse." }) };
  }
  const startedAt = new Date();
  const result = await input.adapter.createR2Bucket(input.accountId, input.config.r2BucketName, input.productionAuthorizationEvidence);
  if (!result.ok) return { ok: false, step: recordAdapterResult({ ...input, startedAt, result }) };
  const reread = await input.adapter.listR2Buckets(input.accountId);
  const verified = verifyR2(reread, result.resource);
  if (!verified.ok) {
    return {
      ok: false,
      step: recordAdapterResult({
        ...input,
        startedAt,
        result: {
          ok: false,
          status: verified.status,
          rawSummary: verified.message,
          warnings: [],
          errorCode: verified.code,
          errorMessage: verified.message,
          retryable: true,
        },
      }),
    };
  }
  return { ok: true, step: recordAdapterResult({ ...input, startedAt, result }), resource: result.resource };
}

function verifyD1(reread: AdapterResult<D1Resource[]>, resource: D1Resource | undefined) {
  if (!reread.ok) return { ok: false as const, status: reread.status, code: reread.errorCode ?? "D1_REREAD_FAILED", message: reread.errorMessage ?? reread.rawSummary };
  if (!resource?.id) return { ok: false as const, status: "parse-failed" as const, code: "D1_CREATE_MISSING_RESOURCE_ID", message: "D1 adapter create result did not include a database id." };
  const match = reread.resource?.find((database) => database.name === resource.name && database.id === resource.id);
  if (!match) return { ok: false as const, status: "fail" as const, code: "D1_CREATE_REREAD_MISMATCH", message: "D1 create result was not found by post-create re-read." };
  return { ok: true as const };
}

function verifyR2(reread: AdapterResult<R2Resource[]>, resource: R2Resource | undefined) {
  if (!reread.ok) return { ok: false as const, status: reread.status, code: reread.errorCode ?? "R2_REREAD_FAILED", message: reread.errorMessage ?? reread.rawSummary };
  if (!resource?.name) return { ok: false as const, status: "parse-failed" as const, code: "R2_CREATE_MISSING_RESOURCE_NAME", message: "R2 adapter create result did not include a bucket name." };
  const match = reread.resource?.find((bucket) => bucket.name === resource.name);
  if (!match) return { ok: false as const, status: "fail" as const, code: "R2_CREATE_REREAD_MISMATCH", message: "R2 create result was not found by post-create re-read." };
  return { ok: true as const };
}

async function executeR2Probe(input: {
  adapter: ControlledCloudflareAdapter;
  operation: OperationPlan;
  accountId: string;
  bucketName: string;
  mode: ControlledWorkflowReport["mode"];
  options: RemoteExecutionOptions;
  planHash: string;
  productionAuthorizationEvidence?: ProductionAuthorizationEvidence;
}): Promise<{ ok: boolean; steps: ExecutionStepResult[] }> {
  const key = `.contentforge-probe/${input.operation.operationId}.txt`;
  const content = `contentforge-r2-probe:${input.operation.operationId}:${input.planHash}`;
  const steps: ExecutionStepResult[] = [];

  const preReadStarted = new Date();
  const preRead = await input.adapter.getR2Object(input.accountId, input.bucketName, key, input.productionAuthorizationEvidence);
  if (preRead.ok) {
    steps.push(recordAdapterResult({ ...input, startedAt: preReadStarted, result: { ...preRead, ok: false, status: "conflict", errorCode: "R2_PROBE_OBJECT_ALREADY_EXISTS", errorMessage: "R2 probe object already exists.", rawSummary: "R2 probe object already exists.", retryable: false } }));
    return { ok: false, steps };
  }
  if (preRead.errorCode && !isR2ObjectNotFound(preRead)) {
    steps.push(recordAdapterResult({ ...input, startedAt: preReadStarted, result: preRead }));
    return { ok: false, steps };
  }

  const putStarted = new Date();
  const put = await input.adapter.putR2Object(input.accountId, input.bucketName, key, content, input.productionAuthorizationEvidence);
  steps.push(recordAdapterResult({ ...input, startedAt: putStarted, result: put }));
  if (!put.ok) return { ok: false, steps };

  const readStarted = new Date();
  const read = await input.adapter.getR2Object(input.accountId, input.bucketName, key, input.productionAuthorizationEvidence);
  const readResult = read.ok && read.resource?.body === content
    ? read
    : { ...read, ok: false, status: "fail" as const, errorCode: "R2_PROBE_READ_MISMATCH", errorMessage: "R2 probe read content did not match upload.", rawSummary: "R2 probe read content did not match upload.", retryable: true };
  steps.push(recordAdapterResult({ ...input, startedAt: readStarted, result: readResult }));
  if (!readResult.ok) return { ok: false, steps };

  const deleteStarted = new Date();
  const deleted = await input.adapter.deleteR2Object(input.accountId, input.bucketName, key, input.productionAuthorizationEvidence);
  steps.push(recordAdapterResult({ ...input, startedAt: deleteStarted, result: deleted }));
  if (!deleted.ok) return { ok: false, steps };

  const postReadStarted = new Date();
  const postRead = await input.adapter.getR2Object(input.accountId, input.bucketName, key, input.productionAuthorizationEvidence);
  const postResult = !postRead.ok && isR2ObjectNotFound(postRead)
    ? { ok: true, status: "pass" as const, resource: { key }, rawSummary: "r2 probe delete verified by not-found read", warnings: [], retryable: false }
    : { ...postRead, ok: false, status: "fail" as const, errorCode: "R2_PROBE_DELETE_VERIFY_FAILED", errorMessage: "R2 probe object remained readable after delete.", rawSummary: "R2 probe object remained readable after delete.", retryable: true };
  steps.push(recordAdapterResult({ ...input, startedAt: postReadStarted, result: postResult }));
  return { ok: postResult.ok, steps };
}

function isR2ObjectNotFound(result: AdapterResult) {
  return result.status === "not-found" || result.errorCode === "R2_OBJECT_NOT_FOUND" || result.errorCode === "R2_NOT_FOUND";
}

function recordAdapterResult(input: {
  operation: OperationPlan;
  accountId: string;
  mode: ControlledWorkflowReport["mode"];
  options: RemoteExecutionOptions;
  planHash: string;
  startedAt: Date;
  result: AdapterResult;
}): ExecutionStepResult {
  const completedAt = new Date();
  const outcome = input.result.ok ? "success" : "failed";
  const step: ExecutionStepResult = {
    stepId: input.operation.stepId,
    operationKey: input.operation.operationKey,
    resource: input.operation.targetSummary,
    action: input.operation.action,
    startedAt: input.startedAt.toISOString(),
    completedAt: completedAt.toISOString(),
    outcome,
    errorCode: input.result.errorCode,
    evidence: input.result.rawSummary,
    durationMs: completedAt.getTime() - input.startedAt.getTime(),
  };
  appendAuditFromStep({ ...input, step, result: outcome });
  return step;
}

function recordConfigPatchResult(input: {
  operation: OperationPlan;
  accountId: string;
  mode: ControlledWorkflowReport["mode"];
  options: RemoteExecutionOptions;
  planHash: string;
  startedAt: Date;
  result: ConfigPatchResult;
}): ExecutionStepResult {
  const completedAt = new Date();
  const outcome = input.result.ok ? "success" : "failed";
  const step: ExecutionStepResult = {
    stepId: input.operation.stepId,
    operationKey: input.operation.operationKey,
    resource: input.operation.targetSummary,
    action: input.operation.action,
    startedAt: input.startedAt.toISOString(),
    completedAt: completedAt.toISOString(),
    outcome,
    errorCode: input.result.errorCode,
    evidence: input.result.ok ? `changed=${input.result.changedFiles.join(",") || "none"} journal=${input.result.journalDir}` : input.result.message,
    durationMs: completedAt.getTime() - input.startedAt.getTime(),
  };
  appendAuditFromStep({ ...input, step, result: outcome });
  return step;
}

function recordPhase4Result(input: {
  operation: OperationPlan;
  accountId: string;
  mode: ControlledWorkflowReport["mode"];
  options: RemoteExecutionOptions;
  planHash: string;
  startedAt: Date;
  result: Phase4Result;
}): ExecutionStepResult {
  const completedAt = new Date();
  const outcome = input.result.ok ? "success" : "failed";
  const step: ExecutionStepResult = {
    stepId: input.operation.stepId,
    operationKey: input.operation.operationKey,
    resource: input.operation.targetSummary,
    action: input.operation.action,
    startedAt: input.startedAt.toISOString(),
    completedAt: completedAt.toISOString(),
    outcome,
    errorCode: input.result.code,
    evidence: input.result.message,
    durationMs: completedAt.getTime() - input.startedAt.getTime(),
  };
  appendAuditFromStep({ ...input, step, result: outcome });
  return step;
}

function recordD1SourceResult(input: {
  operation: OperationPlan;
  accountId: string;
  mode: ControlledWorkflowReport["mode"];
  options: RemoteExecutionOptions;
  planHash: string;
  startedAt: Date;
  result: AdapterResult;
  source: D1SqlSource;
}): ExecutionStepResult {
  const step = recordAdapterResult(input);
  step.evidence = `${input.result.rawSummary}; source=${input.source.path}; hash=${input.source.hash}; statements=${input.source.statementCount}; purpose=${input.source.purpose}`;
  return step;
}

function recordSkippedOrBlocked(input: {
  operation: OperationPlan;
  accountId: string;
  mode: ControlledWorkflowReport["mode"];
  options: RemoteExecutionOptions;
  planHash: string;
  outcome: "success" | "blocked" | "failed" | "skipped";
  errorCode?: string;
  evidence: string;
}): ExecutionStepResult {
  const now = new Date().toISOString();
  const step: ExecutionStepResult = {
    stepId: input.operation.stepId,
    operationKey: input.operation.operationKey,
    resource: input.operation.targetSummary,
    action: input.operation.action,
    startedAt: now,
    completedAt: now,
    outcome: input.outcome,
    errorCode: input.errorCode,
    evidence: input.evidence,
    durationMs: 0,
  };
  appendAuditFromStep({ ...input, step, result: input.outcome });
  return step;
}

function appendAuditFromStep(input: {
  operation: OperationPlan;
  accountId: string;
  mode: ControlledWorkflowReport["mode"];
  options: RemoteExecutionOptions;
  planHash: string;
  step: ExecutionStepResult;
  result: "success" | "blocked" | "failed" | "skipped";
}) {
  appendOperationRecord({
    operationId: input.operation.operationId,
    timestamp: input.step.completedAt,
    startedAt: input.step.startedAt,
    completedAt: input.step.completedAt,
    riskLevel: input.operation.riskLevel,
    stepId: input.operation.stepId,
    operationKey: input.operation.operationKey,
    accountId: input.accountId,
    resourceType: input.operation.resourceType,
    resourceName: input.operation.resourceName,
    resourceId: input.operation.resourceId,
    action: input.operation.action,
    mode: input.mode,
    confirmation: input.options.yes ? "yes" : "not-required",
    allowFlagsUsed: input.operation.requiredAllowFlags.filter((flag) => input.options.allowFlags[flag]),
    targetSummary: input.operation.targetSummary,
    planHash: input.planHash,
    previousState: input.operation.previousState,
    resultingState: input.result === "success" ? "verified" : "failed",
    result: input.result,
    outcome: input.result,
    duration: input.step.durationMs,
    errorCode: input.step.errorCode,
    errorMessage: input.step.errorCode,
    evidence: input.step.evidence,
    retryable: input.result === "failed",
  });
}

function writeExecutionReport(input: {
  config: BootstrapConfigInput;
  options: RemoteExecutionOptions;
  wranglerVersion: string;
  planHash: string;
  operations: OperationPlan[];
  executionSteps: ExecutionStepResult[];
  summary: ControlledWorkflowReport["summary"];
  configPatch?: ConfigPatchResult;
  writeAuthorization?: WriteAuthorizationDecision[];
  productionResourceAuthorization?: ProductionResourceAuthorizationResult;
}) {
  const dir = path.join(projectRoot, ".contentforge");
  mkdirSync(dir, { recursive: true });
  const jsonPath = path.join(dir, "production-execution-report.json");
  const mdPath = path.join(dir, "production-execution-report.md");
  const inferredProductionResourceAuthorization = input.productionResourceAuthorization ?? inferPostAuthorizationStatus(input);
  const payload = {
    schemaVersion: 2,
    operationId: input.operations[0]?.operationId ?? "production-execution",
    generatedAt: new Date().toISOString(),
    account: input.options.accountId || input.config.cloudflareAccountId,
    adapter: input.options.adapterMode,
    wranglerVersion: input.wranglerVersion,
    approvedPlanHash: input.options.approvedPlanHash,
    planHash: input.planHash,
    summary: input.summary,
    verdict: productionVerdict(input.summary, input.executionSteps),
    domainDnsStatus: "not-run-default-closed-loop",
    allowDecisions: Object.fromEntries(Object.entries(input.options.allowFlags).map(([key, value]) => [key, Boolean(value)])),
    productionResourceAuthorizationRequested: inferredProductionResourceAuthorization?.requested ?? input.options.allowProductionResources,
    productionResourceEnvironmentEnabled: inferredProductionResourceAuthorization?.environmentEnabled ?? process.env.CONTENTFORGE_ENABLE_PRODUCTION_RESOURCE_WRITES === "1",
    productionResourceAuthorization: inferredProductionResourceAuthorization?.authorized ?? false,
    productionResourceChecks: inferredProductionResourceAuthorization?.checks ?? [],
    productionResourceSetHash: inferredProductionResourceAuthorization?.resourceSetHash,
    writeAuthorizationDecisions: input.writeAuthorization ?? evaluateFullWritePreflight({ operations: input.operations, options: input.options }),
    missingWriteAllowFlags: (input.writeAuthorization ?? evaluateFullWritePreflight({ operations: input.operations, options: input.options }))
      .filter((decision) => decision.planned && !decision.authorized)
      .flatMap((decision) => decision.requiredFlags.filter((flag) => !input.options.allowFlags[flag])),
    resourcesBefore: input.operations.map((operation) => ({ stepId: operation.stepId, previousState: operation.previousState, ownership: operation.ownership })),
    resources: input.operations.map((operation) => ({
      stepId: operation.stepId,
      resourceType: operation.resourceType,
      resourceName: operation.resourceName,
      ownershipBefore: operation.ownership,
      action: operation.action,
      previousState: operation.previousState,
      resultingState: operation.resultingState,
    })),
    actualResults: input.executionSteps,
    configPatchRequested: input.operations.some((operation) => operation.stepId === "config-patch"),
    configPatchAuthorized: input.options.allowFlags.allowConfigPatch,
    patchOperationId: input.operations.find((operation) => operation.stepId === "config-patch")?.operationId,
    configPatch: input.configPatch
      ? {
          ok: input.configPatch.ok,
          targetFiles: input.configPatch.journals.map((journal) => journal.filePath),
          beforeHashes: Object.fromEntries(input.configPatch.journals.map((journal) => [journal.filePath, journal.beforeHash])),
          afterHashes: Object.fromEntries(input.configPatch.journals.map((journal) => [journal.filePath, journal.afterHash])),
          fieldsChanged: Object.fromEntries(input.configPatch.journals.map((journal) => [journal.filePath, journal.patchFields])),
          validation: input.configPatch.validation,
          rollbackAvailable: input.configPatch.rollbackAvailable,
          rollbackAttempted: input.configPatch.journals.some((journal) => journal.rollbackStatus === "applied" || journal.rollbackStatus === "blocked"),
          rollbackResult: input.configPatch.journals.map((journal) => ({ filePath: journal.filePath, rollbackStatus: journal.rollbackStatus })),
        }
      : undefined,
    workerRemoteVerified: input.executionSteps.some((step) => step.stepId === "worker" && step.outcome === "success"),
    workerConfigPrepared: true,
    buildResult: stepOutcome(input.executionSteps, "build"),
    deployAuthorized: input.options.allowFlags.allowDeploy,
    deployResult: stepOutcome(input.executionSteps, "deploy"),
    workerDeployed: input.executionSteps.some((step) => step.stepId === "deploy" && step.outcome === "success"),
    workerVerification: input.executionSteps.some((step) => step.stepId === "deploy" && step.outcome === "success") ? "verified-by-adapter-result" : "not-verified",
    secretNamesAttempted: input.executionSteps.filter((step) => step.stepId === "secrets").map((step) => step.resource),
    secretResults: input.executionSteps.filter((step) => step.stepId === "secrets").map((step) => ({ outcome: step.outcome, errorCode: step.errorCode })),
    secretVerificationStatus: input.executionSteps.some((step) => step.stepId === "secrets" && step.outcome === "success") ? "command-success-name-only" : "not-verified",
    d1SchemaSourceHashes: input.executionSteps.filter((step) => step.stepId === "d1-schema").map((step) => step.evidence).filter(Boolean),
    d1SchemaResult: stepOutcome(input.executionSteps, "d1-schema"),
    seedRequested: input.options.allowFlags.allowBootstrapSeed,
    seedAuthorized: input.options.allowFlags.allowD1Write && input.options.allowFlags.allowBootstrapSeed,
    seedDatasetHash: input.executionSteps.find((step) => step.stepId === "d1-seed")?.evidence?.match(/hash=([a-f0-9]{64})/)?.[1],
    seedResult: stepOutcome(input.executionSteps, "d1-seed"),
    d1VerificationCounts: input.executionSteps.some((step) => step.stepId === "d1-schema" && step.outcome === "success") ? "schema verified; seed counts are in controlled verification result" : "not-verified",
    partialDeploymentStatus: input.executionSteps.some((step) => step.stepId === "deploy" && step.outcome === "success") && input.summary !== "passed" ? "partial" : "none",
    resumeEligibility: input.executionSteps.some((step) => step.outcome === "success") ? "eligible-with-approved-plan-and-matching-hashes" : "not-eligible",
    d1IdCaptured: input.executionSteps.some((step) => step.stepId === "d1" && step.outcome === "success"),
    r2Verified: input.executionSteps.some((step) => step.stepId === "r2" && step.outcome === "success"),
    r2Probe: {
      authorized: input.options.allowFlags.allowR2Probe,
      keyPattern: ".contentforge-probe/<operationId>.txt",
      verified: input.executionSteps.filter((step) => step.stepId === "r2-probe").length >= 4 && input.executionSteps.filter((step) => step.stepId === "r2-probe").every((step) => step.outcome === "success"),
      results: input.executionSteps.filter((step) => step.stepId === "r2-probe").map((step) => ({ outcome: step.outcome, errorCode: step.errorCode, evidence: step.evidence })),
    },
    nextBlockedStep: input.executionSteps.find((step) => step.outcome === "blocked")?.stepId,
    blockedSteps: input.executionSteps.filter((step) => step.outcome === "blocked").map((step) => step.stepId),
    warnings: [
      "Domain/DNS remains outside the default execution loop.",
      "Real Cloudflare writes remain blocked unless exact operation-specific env gates are set.",
    ],
  };
  writeFileSync(jsonPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  writeFileSync(mdPath, renderExecutionMarkdown(payload), "utf8");
  return path.relative(projectRoot, jsonPath);
}

function stepOutcome(steps: ExecutionStepResult[], stepId: string) {
  return steps.find((step) => step.stepId === stepId)?.outcome ?? "not-run";
}

function inferPostAuthorizationStatus(input: {
  options: RemoteExecutionOptions;
  operations: OperationPlan[];
  executionSteps: ExecutionStepResult[];
}): ProductionResourceAuthorizationResult | undefined {
  if (!input.options.allowProductionResources || input.executionSteps.length === 0) return undefined;
  const names = [
    input.operations.find((operation) => operation.stepId === "worker")?.resourceName ?? "",
    input.operations.find((operation) => operation.stepId === "d1")?.resourceName ?? "",
    input.operations.find((operation) => operation.stepId === "r2")?.resourceName ?? "",
  ].filter(Boolean);
  return {
    requested: true,
    environmentEnabled: process.env.CONTENTFORGE_ENABLE_PRODUCTION_RESOURCE_WRITES === "1",
    isTestResourceSet: false,
    authorized: true,
    checks: [{ id: "production-resource-authorization", status: "pass", detail: "Production resource authorization completed before execution steps started." }],
    resourceSetHash: hashProductionResourceSet(names),
  };
}

function renderExecutionMarkdown(payload: {
  generatedAt: string;
  account: string;
  adapter: string;
  wranglerVersion: string;
  planHash: string;
    summary: string;
    verdict?: string;
  actualResults: ExecutionStepResult[];
  warnings: string[];
}) {
  return [
    "# Production Execution Report",
    "",
    `Generated: ${payload.generatedAt}`,
    `Account: ${payload.account || "not-selected"}`,
    `Adapter: ${payload.adapter}`,
    `Wrangler: ${payload.wranglerVersion}`,
    `Plan hash: ${payload.planHash}`,
    `Summary: ${payload.summary}`,
    `Verdict: ${payload.verdict ?? payload.summary}`,
    "",
    "## Actual Results",
    ...payload.actualResults.map((step) => `- ${step.outcome} ${step.stepId}: ${step.action} (${step.evidence ?? "no evidence"})`),
    "",
    "## Warnings",
    ...payload.warnings.map((warning) => `- ${warning}`),
    "",
  ].join("\n");
}

function productionVerdict(summary: ControlledWorkflowReport["summary"], steps: ExecutionStepResult[]) {
  if (summary === "blocked") return "blocked";
  if (summary === "failed") return steps.some((step) => step.outcome === "success") ? "recovery-required" : "failed";
  if (summary === "action-required") return "blocked";
  if (steps.some((step) => step.outcome === "blocked" || step.outcome === "failed")) return "production-execution-partial";
  return "production-execution-complete";
}

function failedExecutionReport(input: {
  mode: ControlledWorkflowReport["mode"];
  adapter: ControlledCloudflareAdapter;
  wranglerVersion: string;
  riskLevel: number;
  accountId: string;
  planHash: string;
  checks: ControlledWorkflowReport["checks"];
  operations: OperationPlan[];
  executionSteps: ExecutionStepResult[];
  executionReportPath: string;
}): ControlledWorkflowReport {
  const failed = input.executionSteps.find((step) => step.outcome === "failed" || step.outcome === "blocked");
  return {
    mode: input.mode,
    adapter: input.adapter.mode,
    wranglerVersion: input.wranglerVersion,
    riskLevel: input.riskLevel,
    accountId: input.accountId,
    summary: failed?.outcome === "blocked" ? "blocked" : "failed",
    planHash: input.planHash,
    checks: [
      ...input.checks,
      { id: failed?.stepId ?? "execute", status: failed?.outcome === "blocked" ? "blocked" : "failed", detail: `${failed?.errorCode ?? "EXECUTION_FAILED"}: ${failed?.evidence ?? "Execution failed."}` },
      { id: "execution-report", status: "pass", detail: input.executionReportPath },
    ],
    operations: input.operations,
    remoteCalls: [...input.adapter.callLog],
    executionReportPath: input.executionReportPath,
  };
}

function readLocalConfigHashes() {
  return {
    wrangler: hashFileIfExists(path.join(projectRoot, "wrangler.jsonc")),
    starter: hashFileIfExists(path.join(projectRoot, "starter.site.json")),
  };
}

function hashFileIfExists(filePath: string) {
  return existsSync(filePath) ? sha256(readFileSync(filePath, "utf8")) : "missing";
}

function loadResumeState(planHash: string, options: RemoteExecutionOptions): { ok: true; completedSteps: Set<string> } | { ok: false; code: string; message: string; completedSteps: Set<string> } {
  if (!options.resume) return { ok: true, completedSteps: new Set() };
  if (!options.approvedPlanHash) return { ok: false, code: "RESUME_APPROVED_PLAN_HASH_REQUIRED", message: "Resume requires --approved-plan-hash.", completedSteps: new Set() };
  const reportPath = path.join(projectRoot, ".contentforge", "production-execution-report.json");
  if (!existsSync(reportPath)) return { ok: true, completedSteps: new Set() };
  try {
    const report = JSON.parse(readFileSync(reportPath, "utf8")) as { planHash?: string; actualResults?: Array<{ stepId?: string; outcome?: string }> };
    if (report.planHash && report.planHash !== planHash) return { ok: false, code: "RESUME_STALE_REPORT_BLOCKED", message: "Resume report plan hash is stale.", completedSteps: new Set() };
    return {
      ok: true,
      completedSteps: new Set((report.actualResults ?? []).filter((step) => step.stepId && step.outcome === "success").map((step) => step.stepId as string)),
    };
  } catch {
    return { ok: false, code: "RESUME_REPORT_PARSE_FAILED", message: "Resume report could not be parsed.", completedSteps: new Set() };
  }
}
