import crypto from "node:crypto";
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { createControlledAdapter, type ControlledCloudflareAdapter } from "./cloudflare-adapter";
import {
  defaultAllowFlags,
  generateSessionSecret,
  parseAdapterMode,
  requireRuntimeAdminPassword,
  r2ProbeKey,
  stableJson,
  type AllowFlags,
} from "./cloudflare-execution";
import { generateIntegrationPrefix, integrationResourceNames, validateIntegrationPrefix } from "./cloudflare-integration-names";
import type {
  IntegrationBaseline,
  IntegrationCleanupPolicy,
  IntegrationManifest,
  IntegrationOptions,
  IntegrationPlan,
  IntegrationResourceRecord,
  IntegrationRunReport,
  IntegrationStepResult,
  IntegrationVerdict,
} from "./cloudflare-integration-types";
import { appendOperationRecord, sanitizeOperationRecord } from "./production-audit";
import { acquireProductionLock, releaseProductionLock } from "./production-lock";
import { projectRoot, runCommand } from "./cli-utils";
import { resolveBootstrapConfig } from "./production-bootstrap";

const integrationDir = path.join(".contentforge", "integration");
const integrationSteps = ["baseline", "worker-create", "deploy-first", "d1-create", "d1-migrate", "r2-create", "r2-probe", "secrets", "deploy-second", "cleanup"];
const realIntegrationLimitations = [
  "Real Cloudflare integration not tested.",
  "Real Worker creation not tested.",
  "Real D1 creation/migration not tested.",
  "Real R2 creation/probe not tested.",
  "Real Secret put not tested.",
  "Real Deploy not tested.",
  "Real Domain/DNS integration not tested.",
  "Legacy integration runner is mock/offline-only; real Wrangler execution must use production:setup -- --execute or production:certify.",
];

export function parseIntegrationArgs(args: string[]): IntegrationOptions {
  const options: IntegrationOptions = {
    adapterMode: "offline",
    plan: false,
    integration: false,
    accountId: "",
    resourcePrefix: "",
    allowCleanup: false,
    retainOnFailure: false,
    cleanupOnFailure: false,
    timeoutSeconds: 120,
    yes: false,
    allowFlags: { ...defaultAllowFlags },
  };

  for (const arg of args) {
    if (arg === "--plan") options.plan = true;
    else if (arg === "--integration") options.integration = true;
    else if (arg === "--yes") options.yes = true;
    else if (arg === "--allow-create-worker" || arg === "--allow-worker-create") options.allowFlags.allowCreateWorker = true;
    else if (arg === "--allow-create-d1" || arg === "--allow-d1-create") options.allowFlags.allowCreateD1 = true;
    else if (arg === "--allow-create-r2" || arg === "--allow-r2-create") options.allowFlags.allowCreateR2 = true;
    else if (arg === "--allow-set-secrets" || arg === "--allow-secret-write") options.allowFlags.allowSetSecrets = true;
    else if (arg === "--allow-deploy") options.allowFlags.allowDeploy = true;
    else if (arg === "--allow-d1-write" || arg === "--allow-d1-execute") options.allowFlags.allowD1Write = true;
    else if (arg === "--allow-config-patch") options.allowFlags.allowConfigPatch = true;
    else if (arg === "--allow-bootstrap-seed") options.allowFlags.allowBootstrapSeed = true;
    else if (arg === "--allow-cleanup") options.allowCleanup = true;
    else if (arg === "--retain-on-failure") options.retainOnFailure = true;
    else if (arg === "--cleanup-on-failure") options.cleanupOnFailure = true;
    else if (arg.startsWith("--adapter=")) options.adapterMode = parseAdapterMode(arg.slice("--adapter=".length));
    else if (arg.startsWith("--account-id=")) options.accountId = arg.slice("--account-id=".length).trim();
    else if (arg.startsWith("--resource-prefix=")) options.resourcePrefix = arg.slice("--resource-prefix=".length).trim();
    else if (arg.startsWith("--approved-plan-hash=")) options.approvedPlanHash = arg.slice("--approved-plan-hash=".length).trim();
    else if (arg.startsWith("--cleanup-only=")) options.cleanupOnly = arg.slice("--cleanup-only=".length).trim();
    else if (arg.startsWith("--resume=")) options.resume = arg.slice("--resume=".length).trim();
    else if (arg.startsWith("--step=")) options.step = arg.slice("--step=".length).trim();
    else if (arg.startsWith("--timeout=")) options.timeoutSeconds = Number(arg.slice("--timeout=".length).trim());
    else throw new Error(`Unknown Cloudflare integration argument: ${arg}`);
  }

  return options;
}

export async function runCloudflareIntegration(input: {
  options: IntegrationOptions;
  adapter?: ControlledCloudflareAdapter;
  now?: Date;
}): Promise<IntegrationRunReport> {
  const { config } = resolveBootstrapConfig({});
  const now = input.now ?? new Date();
  const operationId = input.options.resume || input.options.cleanupOnly || operationIdFromPrefix(input.options.resourcePrefix) || `it-${crypto.randomBytes(8).toString("hex")}`;
  const resourcePrefix = input.options.resourcePrefix || (input.options.plan ? generateIntegrationPrefix(now) : "");
  const names = integrationResourceNames(resourcePrefix || "contentforge-it-missing");
  const checks: IntegrationRunReport["checks"] = [];

  if (!input.options.plan && !input.options.integration && !input.options.cleanupOnly && !input.options.resume) {
    return blockedReport({ options: input.options, operationId, resourcePrefix, names, checks, reason: "Integration runner is blocked by default. Use --plan for offline planning or --integration with explicit mock/wrangler gates." });
  }

  if (input.options.adapterMode === "wrangler") {
    return blockedReport({ options: input.options, operationId, resourcePrefix: resourcePrefix || "contentforge-it-wrangler-disabled", names, checks, reason: "LEGACY_INTEGRATION_RUNNER_WRANGLER_DISABLED: legacy integration runner is mock/offline-only; use production:setup -- --execute for real Wrangler execution." });
  }

  if (input.options.cleanupOnly) {
    return runCleanupOnly(input.options, operationId);
  }

  const prefixErrors = validateIntegrationPrefix(resourcePrefix, config);
  if (prefixErrors.length > 0) {
    return blockedReport({ options: input.options, operationId, resourcePrefix, names, checks, reason: prefixErrors.join("; ") });
  }

  const adapter = input.adapter ?? createControlledAdapter(input.options.adapterMode);
  const baseline = await buildBaseline(input.options, adapter, names);
  const collision = findCollision(baseline, [names.workerName, names.d1Name, names.r2Name]);
  if (collision) {
    return blockedReport({ options: input.options, operationId, resourcePrefix, names, checks, baseline, reason: `Resource collision detected: ${collision}` });
  }

  const generatedAt = readExistingCreatedAt(operationId) ?? now.toISOString();
  const plan = await buildIntegrationPlan({ options: input.options, adapter, operationId, resourcePrefix, names, baseline, generatedAt });
  const planHash = hashIntegrationPlan(plan);
  const required = requiredMissing(input.options);

  if (input.options.plan) {
    const manifest = makeManifest({ options: input.options, plan, planHash, baseline, verdict: "planned", steps: [], resources: [], cleanupStatus: "not-required" });
    return writeIntegrationReport({ manifest, resources: [], checks: [...checks, { id: "plan", status: "pass", detail: "Offline integration plan generated without remote access." }], planHash });
  }

  if (!input.options.accountId) {
    return blockedPlanReport({ options: input.options, plan, planHash, baseline, checks, reason: "Integration execution requires --account-id." });
  }
  if (!input.options.approvedPlanHash || input.options.approvedPlanHash !== planHash) {
    return blockedPlanReport({ options: input.options, plan, planHash, baseline, checks, reason: input.options.approvedPlanHash ? "Approved integration plan hash is stale." : "Integration execution requires --approved-plan-hash." });
  }
  if (required.length > 0) {
    return blockedPlanReport({ options: input.options, plan, planHash, baseline, checks, reason: `Missing allow flag(s): ${required.join(", ")}` });
  }

  const lock = acquireProductionLock({ operationId, mode: "cloudflare-integration", riskLevel: 3, targetSummary: resourcePrefix });
  try {
    const resources: IntegrationResourceRecord[] = [];
    const steps: IntegrationStepResult[] = [];
    const realCloudflareAccess = false;
    const realResourcesCreated = false;
    await runMockOrchestration({ options: input.options, adapter, operationId, accountId: input.options.accountId, names, resources, steps, planHash });
    const cleanupStatus = input.options.allowCleanup ? "completed" : "required";
    if (input.options.allowCleanup) {
      for (const resource of resources) {
        resource.cleanupEligible = isCleanupEligible(resource);
      }
      steps.push({ stepId: "cleanup", state: "cleaned", summary: "Mock cleanup verified with creation evidence.", retryable: false });
    }
    const manifest = makeManifest({
      options: input.options,
      plan,
      planHash,
      baseline,
      verdict: realCloudflareAccess ? "real-passed" : "mock-passed",
      steps,
      resources,
      cleanupStatus,
      realCloudflareAccess,
      realResourcesCreated,
    });
    return writeIntegrationReport({ manifest, resources, checks: [...checks, { id: "integration", status: "pass", detail: "Mock integration completed through controlled adapter gates." }], planHash });
  } catch (error) {
    const manifest = makeManifest({ options: input.options, plan, planHash, baseline, verdict: "failed", steps: [{ stepId: "failure", state: "failed", summary: error instanceof Error ? error.message : "Unknown integration failure.", retryable: true }], resources: [], cleanupStatus: input.options.cleanupOnFailure ? "required" : "skipped" });
    return writeIntegrationReport({ manifest, resources: [], checks: [...checks, { id: "failure", status: "fail", detail: manifest.stepResults[0]?.summary ?? "Integration failed." }], planHash });
  } finally {
    releaseProductionLock(lock.operationId);
  }
}

async function runMockOrchestration(input: {
  options: IntegrationOptions;
  adapter: ControlledCloudflareAdapter;
  operationId: string;
  accountId: string;
  names: ReturnType<typeof integrationResourceNames>;
  resources: IntegrationResourceRecord[];
  steps: IntegrationStepResult[];
  planHash: string;
}) {
  const worker = await input.adapter.deployWorker(input.accountId, input.names.workerName);
  input.steps.push({ stepId: "deploy-first", state: worker.ok ? "succeeded" : "failed", summary: worker.rawSummary, retryable: worker.retryable });
  input.resources.push(resourceRecord("worker", input.accountId, input.operationId, worker.resource?.id || `mock-worker-${input.operationId}`, input.names.workerName, input.names.workerName, worker.ok));
  appendIntegrationAudit(input, "worker", input.names.workerName, worker.resource?.id, "deploy-first", worker.ok ? "success" : "failed");
  requireAdapterOk("deploy-first", worker);

  const d1 = await input.adapter.createD1Database(input.accountId, input.names.d1Name);
  input.steps.push({ stepId: "d1-create", state: d1.ok ? "succeeded" : "failed", summary: d1.rawSummary, retryable: d1.retryable });
  input.resources.push(resourceRecord("d1", input.accountId, input.operationId, d1.resource?.id || `mock-d1-${input.operationId}`, input.names.d1Name, input.names.workerName, d1.ok));
  appendIntegrationAudit(input, "d1", input.names.d1Name, d1.resource?.id, "create-d1", d1.ok ? "success" : "failed");
  requireAdapterOk("d1-create", d1);

  const migration = await input.adapter.executeD1(input.accountId, d1.resource?.id || input.names.d1Name, "CREATE TABLE IF NOT EXISTS contentforge_integration_markers (operation_id TEXT PRIMARY KEY)");
  input.steps.push({ stepId: "d1-migrate", state: migration.ok ? "succeeded" : "failed", summary: `${migration.rawSummary}; articles=${migration.resource?.articlesCount ?? 0}`, retryable: migration.retryable });
  requireAdapterOk("d1-migrate", migration);

  const r2 = await input.adapter.createR2Bucket(input.accountId, input.names.r2Name);
  input.steps.push({ stepId: "r2-create", state: r2.ok ? "succeeded" : "failed", summary: r2.rawSummary, retryable: r2.retryable });
  input.resources.push(resourceRecord("r2", input.accountId, input.operationId, `mock-r2-${input.operationId}`, input.names.r2Name, input.names.workerName, r2.ok));
  appendIntegrationAudit(input, "r2", input.names.r2Name, `mock-r2-${input.operationId}`, "create-r2", r2.ok ? "success" : "failed");
  requireAdapterOk("r2-create", r2);

  const probeKey = r2ProbeKey(input.operationId);
  const probeBody = `ContentForge integration probe\noperationId=${input.operationId}`;
  const putProbe = await input.adapter.putR2Object(input.accountId, input.names.r2Name, probeKey, probeBody);
  const readProbe = await input.adapter.getR2Object(input.accountId, input.names.r2Name, probeKey);
  const deleteProbe = await input.adapter.deleteR2Object(input.accountId, input.names.r2Name, probeKey);
  input.steps.push({ stepId: "r2-probe", state: putProbe.ok && readProbe.resource?.body === probeBody && deleteProbe.ok ? "succeeded" : "failed", summary: "R2 probe upload/read/delete used .contentforge-probe path.", retryable: false });
  input.resources.push(resourceRecord("r2-probe", input.accountId, input.operationId, probeKey, probeKey, input.names.workerName, putProbe.ok && readProbe.ok));
  appendIntegrationAudit(input, "r2-probe", probeKey, probeKey, "r2-probe", putProbe.ok && readProbe.ok && deleteProbe.ok ? "success" : "failed");
  if (!putProbe.ok || !readProbe.ok || readProbe.resource?.body !== probeBody || !deleteProbe.ok) {
    throw new Error("r2-probe failed; dependent integration steps stopped.");
  }

  if (input.options.allowFlags.allowSetSecrets) {
    const adminPassword = requireRuntimeAdminPassword({ CONTENTFORGE_ADMIN_PASSWORD: `integration-${crypto.randomUUID()}` });
    const admin = await input.adapter.putWorkerSecret(input.accountId, input.names.workerName, "ADMIN_PASSWORD", adminPassword);
    const session = await input.adapter.putWorkerSecret(input.accountId, input.names.workerName, "SESSION_SECRET", generateSessionSecret());
    input.steps.push({ stepId: "secrets", state: admin.ok && session.ok ? "succeeded" : "failed", summary: "Secret names configured after first deploy.", retryable: admin.retryable || session.retryable });
    appendIntegrationAudit(input, "secret", input.names.workerName, undefined, "set-secrets", admin.ok && session.ok ? "success" : "failed");
    requireAdapterOk("secret ADMIN_PASSWORD", admin);
    requireAdapterOk("secret SESSION_SECRET", session);
  }

  const second = await input.adapter.deployWorker(input.accountId, input.names.workerName);
  input.steps.push({ stepId: "deploy-second", state: second.ok ? "succeeded" : "failed", summary: second.rawSummary, retryable: second.retryable });
  appendIntegrationAudit(input, "deploy", input.names.workerName, worker.resource?.id, "deploy-second", second.ok ? "success" : "failed");
  requireAdapterOk("deploy-second", second);
}

function requireAdapterOk(stepId: string, result: { ok: boolean; rawSummary: string; errorCode?: string }) {
  if (result.ok) return;
  throw new Error(`${stepId} failed: ${result.errorCode ? `${result.errorCode}: ` : ""}${result.rawSummary}`);
}

function appendIntegrationAudit(
  input: {
    operationId: string;
    accountId: string;
    planHash: string;
    options: IntegrationOptions;
  },
  resourceType: string,
  resourceName: string,
  resourceId: string | undefined,
  action: string,
  result: "success" | "failed",
) {
  appendOperationRecord({
    operationId: input.operationId,
    timestamp: new Date().toISOString(),
    riskLevel: 3,
    stepId: action,
    operationKey: `${action}:${input.accountId}:${resourceType}:${resourceId || resourceName}`,
    accountId: input.accountId,
    resourceType,
    resourceName,
    resourceId,
    action,
    mode: "cloudflare-integration",
    confirmation: input.options.yes ? "yes" : "not-required",
    allowFlagsUsed: Object.entries(input.options.allowFlags)
      .filter(([, value]) => value)
      .map(([key]) => key as keyof AllowFlags),
    targetSummary: `${resourceType}:${resourceName}`,
    planHash: input.planHash,
    previousState: "missing",
    resultingState: result === "success" ? "verified" : "failed",
    result,
    duration: 0,
    retryable: result === "failed",
  });
}

async function buildBaseline(options: IntegrationOptions, adapter: ControlledCloudflareAdapter, names: ReturnType<typeof integrationResourceNames>): Promise<IntegrationBaseline> {
  if (options.plan || options.adapterMode === "offline") {
    return { baselineSource: "offline", remoteVerified: false, workers: [], d1: [], r2: [], secretNames: [] };
  }
  if (options.adapterMode === "wrangler" && !isRealIntegrationAuthorized()) {
    return { baselineSource: "offline", remoteVerified: false, workers: [], d1: [], r2: [], secretNames: [] };
  }
  const [workers, d1, r2, secrets] = await Promise.all([
    adapter.listWorkers(options.accountId),
    adapter.listD1Databases(options.accountId),
    adapter.listR2Buckets(options.accountId),
    adapter.listWorkerSecrets(options.accountId, names.workerName),
  ]);
  return {
    baselineSource: options.adapterMode,
    remoteVerified: options.adapterMode === "wrangler",
    workers: (workers.resource ?? []).filter((item) => item.name === names.workerName).map((item) => ({ name: item.name, id: item.id })),
    d1: (d1.resource ?? []).filter((item) => item.name === names.d1Name).map((item) => ({ name: item.name, id: item.id })),
    r2: (r2.resource ?? []).filter((item) => item.name === names.r2Name).map((item) => ({ name: item.name })),
    secretNames: (secrets.resource ?? []).map((item) => item.name),
  };
}

async function buildIntegrationPlan(input: {
  options: IntegrationOptions;
  adapter: ControlledCloudflareAdapter;
  operationId: string;
  resourcePrefix: string;
  names: ReturnType<typeof integrationResourceNames>;
  baseline: IntegrationBaseline;
  generatedAt: string;
}): Promise<IntegrationPlan> {
  return {
    operationId: input.operationId,
    accountId: input.options.accountId,
    resourcePrefix: input.resourcePrefix,
    workerName: input.names.workerName,
    d1Name: input.names.d1Name,
    r2Name: input.names.r2Name,
    steps: integrationSteps,
    allowFlags: { ...input.options.allowFlags, allowCleanup: input.options.allowCleanup },
    wranglerVersion: await wranglerVersionForPlan(input.options, input.adapter),
    frameworkCommit: await gitCommit(),
    adapter: input.options.adapterMode,
    cleanupPolicy: cleanupPolicy(input.options),
    retainOnFailure: input.options.retainOnFailure,
    cleanupOnFailure: input.options.cleanupOnFailure,
    startedBy: safeStartedBy(),
    generatedAt: input.generatedAt,
    baselineHash: sha256(stableJson(input.baseline)),
  };
}

function makeManifest(input: {
  options: IntegrationOptions;
  plan: IntegrationPlan;
  planHash: string;
  baseline: IntegrationBaseline;
  verdict: IntegrationVerdict;
  steps: IntegrationStepResult[];
  resources: IntegrationResourceRecord[];
  cleanupStatus: IntegrationManifest["cleanupStatus"];
  realCloudflareAccess?: boolean;
  realResourcesCreated?: boolean;
}): IntegrationManifest {
  return {
    frameworkCommit: input.plan.frameworkCommit,
    nodeVersion: process.version,
    wranglerVersion: input.plan.wranglerVersion,
    adapter: input.options.adapterMode,
    realCloudflareAccess: input.realCloudflareAccess ?? false,
    realResourcesCreated: input.realResourcesCreated ?? false,
    accountId: input.options.accountId,
    operationId: input.plan.operationId,
    integrationPlanHash: input.planHash,
    resourcePrefix: input.plan.resourcePrefix,
    resourceNames: { worker: input.plan.workerName, d1: input.plan.d1Name, r2: input.plan.r2Name },
    resourceIds: Object.fromEntries(input.resources.map((resource) => [resource.kind, resource.resourceId])),
    cleanupPolicy: input.plan.cleanupPolicy,
    createdAt: input.plan.generatedAt,
    stepResults: input.steps,
    retryableFailures: input.steps.filter((step) => step.retryable && step.state === "failed").map((step) => step.stepId),
    cleanupStatus: input.cleanupStatus,
    finalVerdict: input.verdict,
    knownLimitations: realIntegrationLimitations,
    baseline: input.baseline,
  };
}

function writeIntegrationReport(input: {
  manifest: IntegrationManifest;
  resources: IntegrationResourceRecord[];
  checks: IntegrationRunReport["checks"];
  planHash: string;
}): IntegrationRunReport {
  const outputPath = path.join(projectRoot, integrationDir, input.manifest.operationId);
  mkdirSync(outputPath, { recursive: true });
  const manifest = sanitizeOperationRecord(input.manifest);
  const resources = sanitizeOperationRecord(input.resources);
  writeFileSync(path.join(outputPath, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  writeFileSync(path.join(outputPath, "resources.json"), `${JSON.stringify(resources, null, 2)}\n`, "utf8");
  writeFileSync(path.join(outputPath, "report.md"), renderReport(manifest, input.checks), "utf8");
  for (const step of manifest.stepResults) {
    appendFileSync(path.join(outputPath, "operations.jsonl"), `${JSON.stringify(sanitizeOperationRecord(step))}\n`, "utf8");
  }
  return { manifest, resources, checks: input.checks, planHash: input.planHash, outputPath };
}

function blockedReport(input: {
  options: IntegrationOptions;
  operationId: string;
  resourcePrefix: string;
  names: ReturnType<typeof integrationResourceNames>;
  checks: IntegrationRunReport["checks"];
  reason: string;
  baseline?: IntegrationBaseline;
  planHash?: string;
}) {
  const baseline = input.baseline ?? { baselineSource: "offline" as const, remoteVerified: false, workers: [], d1: [], r2: [], secretNames: [] };
  const plan: IntegrationPlan = {
    operationId: input.operationId,
    accountId: input.options.accountId,
    resourcePrefix: input.resourcePrefix,
    workerName: input.names.workerName,
    d1Name: input.names.d1Name,
    r2Name: input.names.r2Name,
    steps: integrationSteps,
    allowFlags: { ...input.options.allowFlags, allowCleanup: input.options.allowCleanup },
    wranglerVersion: "not-queried",
    frameworkCommit: "unknown",
    adapter: input.options.adapterMode,
    cleanupPolicy: cleanupPolicy(input.options),
    retainOnFailure: input.options.retainOnFailure,
    cleanupOnFailure: input.options.cleanupOnFailure,
    startedBy: safeStartedBy(),
    generatedAt: new Date().toISOString(),
    baselineHash: sha256(stableJson(baseline)),
  };
  const planHash = input.planHash ?? hashIntegrationPlan(plan);
  const manifest = makeManifest({ options: input.options, plan, planHash, baseline, verdict: "blocked", steps: [{ stepId: "gate", state: "blocked", summary: input.reason, retryable: false }], resources: [], cleanupStatus: "not-required" });
  return writeIntegrationReport({ manifest, resources: [], checks: [...input.checks, { id: "gate", status: "blocked", detail: input.reason }], planHash });
}

function blockedPlanReport(input: {
  options: IntegrationOptions;
  plan: IntegrationPlan;
  planHash: string;
  baseline: IntegrationBaseline;
  checks: IntegrationRunReport["checks"];
  reason: string;
}) {
  const manifest = makeManifest({
    options: input.options,
    plan: input.plan,
    planHash: input.planHash,
    baseline: input.baseline,
    verdict: "blocked",
    steps: [{ stepId: "gate", state: "blocked", summary: input.reason, retryable: false }],
    resources: [],
    cleanupStatus: "not-required",
  });
  return writeIntegrationReport({ manifest, resources: [], checks: [...input.checks, { id: "gate", status: "blocked", detail: input.reason }], planHash: input.planHash });
}

function runCleanupOnly(options: IntegrationOptions, operationId: string): IntegrationRunReport {
  if (options.adapterMode !== "wrangler" || !options.accountId || !options.allowCleanup) {
    const prefix = options.resourcePrefix || "contentforge-it-cleanup-blocked";
    const names = integrationResourceNames(prefix);
    return blockedReport({ options, operationId, resourcePrefix: prefix, names, checks: [], reason: "cleanup-only requires --adapter=wrangler, --account-id, and --allow-cleanup." });
  }
  if (!isRealIntegrationAuthorized()) {
    const prefix = options.resourcePrefix || "contentforge-it-cleanup-blocked";
    const names = integrationResourceNames(prefix);
    return blockedReport({ options, operationId, resourcePrefix: prefix, names, checks: [], reason: "cleanup-only requires explicit isolated-account authorization." });
  }
  const manifestPath = path.join(projectRoot, integrationDir, operationId, "manifest.json");
  if (!existsSync(manifestPath)) {
    const prefix = options.resourcePrefix || "contentforge-it-cleanup-missing";
    const names = integrationResourceNames(prefix);
    return blockedReport({ options, operationId, resourcePrefix: prefix, names, checks: [], reason: "cleanup-only manifest was not found." });
  }
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as IntegrationManifest;
  if (manifest.accountId !== options.accountId) {
    const names = integrationResourceNames(manifest.resourcePrefix);
    return blockedReport({ options, operationId, resourcePrefix: manifest.resourcePrefix, names, checks: [], reason: "cleanup-only account id does not match manifest." });
  }
  return { manifest, resources: [], checks: [{ id: "cleanup-only", status: "blocked", detail: "Real cleanup is not executed in this implementation run." }], planHash: manifest.integrationPlanHash, outputPath: path.dirname(manifestPath) };
}

function resourceRecord(kind: IntegrationResourceRecord["kind"], accountId: string, operationId: string, resourceId: string, resourceName: string, resourcePrefix: string, verified: boolean): IntegrationResourceRecord {
  return {
    kind,
    accountId,
    operationId,
    resourceId,
    resourceName,
    resourcePrefix,
    stateBefore: "missing",
    createdByCurrentOperation: true,
    verifiedAfterCreate: verified,
    cleanupEligible: verified,
    hasUnexpectedBindings: false,
  };
}

export function hashIntegrationPlan(plan: IntegrationPlan) {
  return sha256(stableJson(plan));
}

function findCollision(baseline: IntegrationBaseline, names: string[]) {
  const existing = new Set([...baseline.workers, ...baseline.d1, ...baseline.r2].map((item) => item.name));
  return names.find((name) => existing.has(name));
}

function requiredMissing(options: IntegrationOptions) {
  const required: Array<keyof AllowFlags | "allowCleanup"> = ["allowCreateWorker", "allowDeploy", "allowCreateD1", "allowCreateR2", "allowSetSecrets", "allowD1Write"];
  if (options.allowCleanup || cleanupPolicy(options) === "success-cleanup") required.push("allowCleanup");
  return required.filter((flag) => (flag === "allowCleanup" ? !options.allowCleanup : !options.allowFlags[flag]));
}

function cleanupPolicy(options: IntegrationOptions): IntegrationCleanupPolicy {
  if (options.cleanupOnFailure) return "failure-cleanup";
  if (options.retainOnFailure) return "failure-retain";
  return "success-cleanup";
}

function isCleanupEligible(resource: IntegrationResourceRecord) {
  return resource.stateBefore === "missing" && resource.createdByCurrentOperation && resource.verifiedAfterCreate && !resource.hasUnexpectedBindings;
}

function isRealIntegrationAuthorized() {
  return process.env.CONTENTFORGE_ISOLATED_CLOUDFLARE_AUTHORIZED === "true";
}

function operationIdFromPrefix(prefix: string) {
  if (!prefix) return "";
  return `it-${sha256(prefix).slice(0, 16)}`;
}

function readExistingCreatedAt(operationId: string) {
  const manifestPath = path.join(projectRoot, integrationDir, operationId, "manifest.json");
  if (!existsSync(manifestPath)) return undefined;
  try {
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as IntegrationManifest;
    return manifest.createdAt;
  } catch {
    return undefined;
  }
}

function safeStartedBy() {
  const value = process.env.USERDOMAIN ? `${process.env.USERDOMAIN}\\user` : "local-user";
  return value.replace(/[A-Z]:\\[^ ]+/gi, "<redacted-path>").replace(/[^\s@]+@[^\s@]+/g, "<redacted-email>").slice(0, 80);
}

async function wranglerVersionForPlan(options: IntegrationOptions, adapter: ControlledCloudflareAdapter) {
  if (options.adapterMode === "wrangler" && !isRealIntegrationAuthorized()) return "not-queried";
  const result = await adapter.getWranglerVersion();
  return result.resource ?? "unavailable";
}

async function gitCommit() {
  const result = await runCommand("git", ["rev-parse", "HEAD"], { shell: false });
  return result.code === 0 ? result.stdout.trim() : "unknown";
}

function sha256(value: string) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function renderReport(manifest: IntegrationManifest, checks: IntegrationRunReport["checks"]) {
  return [
    "# ContentForge Cloudflare Integration Report",
    "",
    `Operation: ${manifest.operationId}`,
    `Adapter: ${manifest.adapter}`,
    `Verdict: ${manifest.finalVerdict}`,
    `Plan hash: ${manifest.integrationPlanHash}`,
    `Baseline source: ${manifest.baseline.baselineSource}`,
    `Remote verified: ${manifest.baseline.remoteVerified}`,
    `Real Cloudflare access: ${manifest.realCloudflareAccess}`,
    `Real resources created: ${manifest.realResourcesCreated}`,
    "",
    "## Checks",
    ...checks.map((check) => `- ${check.status} ${check.id}: ${check.detail}`),
    "",
    ...manifest.knownLimitations,
    "",
  ].join("\n");
}

async function cli() {
  const options = parseIntegrationArgs(process.argv.slice(2));
  const report = await runCloudflareIntegration({ options });
  console.log(renderCli(report));
  process.exitCode = report.manifest.finalVerdict === "blocked" ? 5 : report.manifest.finalVerdict === "failed" ? 1 : report.manifest.cleanupStatus === "required" ? 2 : 0;
}

function renderCli(report: IntegrationRunReport) {
  return [
    "ContentForge Cloudflare Integration",
    `Verdict: ${report.manifest.finalVerdict}`,
    `Adapter: ${report.manifest.adapter}`,
    `Plan hash: ${report.planHash}`,
    `Operation: ${report.manifest.operationId}`,
    `Baseline source: ${report.manifest.baseline.baselineSource}`,
    `Remote verified: ${report.manifest.baseline.remoteVerified}`,
    `Real Cloudflare access: ${report.manifest.realCloudflareAccess}`,
    `Real resources created: ${report.manifest.realResourcesCreated}`,
    `Report: ${path.relative(projectRoot, report.outputPath)}`,
    ...report.checks.map((check) => `- ${check.status} ${check.id}: ${check.detail}`),
  ].join("\n");
}

const currentFile = fileURLToPath(import.meta.url);

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(currentFile)) {
  cli().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : "Unknown integration runner error.");
    process.exitCode = 1;
  });
}
