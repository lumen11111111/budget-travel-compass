import crypto from "node:crypto";
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { projectRoot, stripJsonComments } from "./cli-utils";
import type { OperationPlan, RemoteExecutionOptions } from "./cloudflare-execution";
import type { BootstrapConfigInput } from "./production-bootstrap";
import type { WriteAuthorizationDecision } from "./cloudflare-workflows";

export type ProductionResourceAuthorizationCheck = {
  id: string;
  status: "pass" | "blocked" | "skip";
  detail: string;
  errorCode?: string;
};

export type ProductionAuthorizationEvidence = {
  authorized: true;
  planHash: string;
  expectedPlanHash: string;
  accountId: string;
  resourceSetHash: string;
  resourceNames: string[];
  workerName: string;
  d1DatabaseName: string;
  r2BucketName: string;
};

export type ProductionResourceAuthorizationResult = {
  requested: boolean;
  environmentEnabled: boolean;
  isTestResourceSet: boolean;
  authorized: boolean;
  checks: ProductionResourceAuthorizationCheck[];
  errorCode?: string;
  resourceSetHash: string;
  evidence?: ProductionAuthorizationEvidence;
};

type ConfigSnapshot = {
  workerName: string;
  d1DatabaseName: string;
  d1DatabaseId: string;
  r2BucketName: string;
  siteUrl: string;
  r2PublicBaseUrl: string;
  starterWorkerName: string;
  starterD1DatabaseName: string;
  starterD1DatabaseId: string;
  starterR2BucketName: string;
  starterSiteUrl: string;
};

export function evaluateProductionResourceAuthorization(input: {
  config: BootstrapConfigInput;
  options: RemoteExecutionOptions;
  operations: OperationPlan[];
  planHash: string;
  writeAuthorization: WriteAuthorizationDecision[];
  commandName?: "production:setup" | "production:certify";
  gitCleanOverride?: boolean;
}): ProductionResourceAuthorizationResult {
  const configSnapshot = readConfigSnapshot();
  const resourceNames = [input.config.workerName, input.config.d1DatabaseName, input.config.r2BucketName];
  const resourceSetHash = hashProductionResourceSet(resourceNames);
  const requested = input.options.allowProductionResources;
  const environmentEnabled = process.env.CONTENTFORGE_ENABLE_PRODUCTION_RESOURCE_WRITES === "1";
  const isTestResourceSet = resourceNames.every(isTestResourceName);
  const checks: ProductionResourceAuthorizationCheck[] = [];

  if (requested && input.commandName === "production:certify") {
    checks.push(blocked("certification", "PRODUCTION_RESOURCE_CERTIFICATION_FORBIDDEN", "production:certify must not request production resource authorization."));
  }

  if (requested && isTestResourceSet) {
    checks.push(blocked("certification-resource-set", "PRODUCTION_RESOURCE_CERTIFICATION_FORBIDDEN", "Production resource authorization is forbidden for contentforge-it-* certification resources."));
  }

  checks.push({
    id: "resource-prefix",
    status: "pass",
    detail: isTestResourceSet ? "All resources use contentforge-it-* test names." : "Non contentforge-it-* production resource names require explicit production authorization.",
  });

  if (isTestResourceSet && !requested) {
    return { requested, environmentEnabled, isTestResourceSet, authorized: true, checks, resourceSetHash };
  }

  checks.push(checkBoolean("mode", input.options.execute, "PRODUCTION_RESOURCE_AUTHORIZATION_REQUIRED", "mode=execute is required for production resources."));
  checks.push(checkBoolean("adapter", input.options.adapterMode === "wrangler" || input.options.adapterMode === "mock", "PRODUCTION_RESOURCE_AUTHORIZATION_REQUIRED", "adapter must be wrangler for real writes; mock is accepted only for local authorization tests."));
  checks.push(checkBoolean("account", isRealAccountId(input.options.accountId || input.config.cloudflareAccountId), "PRODUCTION_RESOURCE_AUTHORIZATION_REQUIRED", "A real account id is required."));
  checks.push(checkBoolean("approved-plan-hash", Boolean(input.options.approvedPlanHash) && input.options.approvedPlanHash === input.planHash, "PRODUCTION_RESOURCE_AUTHORIZATION_REQUIRED", "Approved plan hash must match the current plan."));
  checks.push(checkBoolean("full-write-preflight", input.writeAuthorization.every((decision) => !decision.planned || decision.authorized), "PRODUCTION_RESOURCE_AUTHORIZATION_REQUIRED", "Full write preflight must pass before production authorization."));
  checks.push(checkBoolean("cli-flag", requested, "PRODUCTION_RESOURCE_AUTHORIZATION_REQUIRED", "--allow-production-resources is required."));
  checks.push(checkBoolean("environment-gate", environmentEnabled, "PRODUCTION_RESOURCE_ENV_GATE_MISSING", "CONTENTFORGE_ENABLE_PRODUCTION_RESOURCE_WRITES=1 is required."));

  const gitClean = input.gitCleanOverride ?? readGitClean();
  checks.push(checkBoolean("git-clean", gitClean, "PRODUCTION_RESOURCE_GIT_DIRTY", "Git working tree must be clean before production resources are authorized."));

  checks.push(...configConsistencyChecks(input.config, input.operations, configSnapshot));
  checks.push(...urlChecks(configSnapshot.siteUrl || input.config.siteUrl));
  checks.push(...nameChecks(input.config));
  checks.push(checkBoolean("cleanup-disabled", !input.options.allowFlags.allowCleanup, "PRODUCTION_RESOURCE_CLEANUP_FORBIDDEN", "Production resource cleanup is always forbidden."));
  checks.push(checkBoolean("domain-disabled", !input.options.allowFlags.allowDomainChange, "PRODUCTION_RESOURCE_AUTHORIZATION_REQUIRED", "Domain changes remain outside default execute."));
  checks.push(checkBoolean("dns-disabled", !input.options.allowFlags.allowDnsChange, "PRODUCTION_RESOURCE_AUTHORIZATION_REQUIRED", "DNS changes remain outside default execute."));

  const firstBlocked = checks.find((check) => check.status === "blocked");
  const authorized = !firstBlocked;
  return {
    requested,
    environmentEnabled,
    isTestResourceSet,
    authorized,
    checks,
    errorCode: firstBlocked?.errorCode,
    resourceSetHash,
    evidence: authorized
      ? {
          authorized: true,
          planHash: input.planHash,
          expectedPlanHash: input.planHash,
          accountId: input.options.accountId || input.config.cloudflareAccountId,
          resourceSetHash,
          resourceNames,
          workerName: input.config.workerName,
          d1DatabaseName: input.config.d1DatabaseName,
          r2BucketName: input.config.r2BucketName,
        }
      : undefined,
  };
}

export function validateProductionAuthorizationEvidence(input: {
  evidence?: ProductionAuthorizationEvidence;
  accountId: string;
  resourceName: string;
  operation: "create" | "deploy" | "secret" | "d1" | "r2";
}) {
  const evidence = input.evidence;
  if (!evidence?.authorized) return { ok: false as const, code: "PRODUCTION_RESOURCE_AUTHORIZATION_REQUIRED", message: "Production resource write requires workflow authorization evidence." };
  if (evidence.accountId !== input.accountId) return { ok: false as const, code: "PRODUCTION_RESOURCE_AUTHORIZATION_REQUIRED", message: "Production authorization account mismatch." };
  if (evidence.planHash !== evidence.expectedPlanHash) return { ok: false as const, code: "PRODUCTION_RESOURCE_AUTHORIZATION_REQUIRED", message: "Production authorization plan hash mismatch." };
  if (evidence.resourceSetHash !== hashProductionResourceSet(evidence.resourceNames)) return { ok: false as const, code: "PRODUCTION_RESOURCE_AUTHORIZATION_REQUIRED", message: "Production authorization resource set hash mismatch." };
  if (input.operation === "d1" && /^[0-9a-f-]{36}$/i.test(input.resourceName)) return { ok: true as const };
  if (!evidence.resourceNames.includes(input.resourceName)) return { ok: false as const, code: "PRODUCTION_RESOURCE_AUTHORIZATION_REQUIRED", message: "Production authorization resource mismatch." };
  return { ok: true as const };
}

export function hashProductionResourceSet(resourceNames: string[]) {
  return crypto.createHash("sha256").update(JSON.stringify([...resourceNames].sort())).digest("hex");
}

function configConsistencyChecks(config: BootstrapConfigInput, operations: OperationPlan[], snapshot: ConfigSnapshot) {
  const operationWorker = operations.find((operation) => operation.stepId === "worker")?.resourceName ?? "";
  const operationD1 = operations.find((operation) => operation.stepId === "d1")?.resourceName ?? "";
  const operationR2 = operations.find((operation) => operation.stepId === "r2")?.resourceName ?? "";
  return [
    checkEqual("worker-config", [operationWorker, config.workerName, snapshot.workerName, snapshot.starterWorkerName], "Worker name must match operation plan, wrangler.jsonc, and starter.site.json."),
    checkEqual("d1-config", [operationD1, config.d1DatabaseName, snapshot.d1DatabaseName, snapshot.starterD1DatabaseName], "D1 name must match operation plan, wrangler.jsonc, and starter.site.json."),
    checkEqual("r2-config", [operationR2, config.r2BucketName, snapshot.r2BucketName, snapshot.starterR2BucketName], "R2 name must match operation plan, wrangler.jsonc, and starter.site.json."),
    checkEqual("site-url-config", [config.siteUrl, snapshot.siteUrl, snapshot.starterSiteUrl], "Site URL must match wrangler.jsonc and starter.site.json."),
  ];
}

function urlChecks(siteUrl: string) {
  let parsed: URL | undefined;
  try {
    parsed = new URL(siteUrl);
  } catch {
    // handled by HTTPS check
  }
  const host = parsed?.hostname.toLowerCase() ?? "";
  return [
    checkBoolean("site-url-https", parsed?.protocol === "https:", "PRODUCTION_RESOURCE_URL_INVALID", "Site URL must be HTTPS."),
    checkBoolean("site-url-not-example", host !== "example.com" && !host.endsWith(".example.com"), "PRODUCTION_RESOURCE_URL_INVALID", "Site URL must not use example.com."),
    checkBoolean("site-url-not-localhost", host !== "localhost" && host !== "127.0.0.1" && host !== "::1", "PRODUCTION_RESOURCE_URL_INVALID", "Site URL must not use localhost."),
  ];
}

function nameChecks(config: BootstrapConfigInput) {
  return [
    checkName("worker-name", config.workerName, ["contentforge-site"]),
    checkName("d1-name", config.d1DatabaseName, ["example-site-db"]),
    checkName("r2-name", config.r2BucketName, ["example-site-media"]),
  ];
}

function checkName(id: string, value: string, placeholders: string[]) {
  const normalized = value.trim();
  const ok = Boolean(normalized) && normalized === value && !/\s/.test(value) && !/^YOUR[_-]/i.test(value) && !placeholders.includes(value) && value !== "00000000-0000-0000-0000-000000000000";
  return checkBoolean(id, ok, "PRODUCTION_RESOURCE_NAME_INVALID", `${id} must be a non-placeholder production name.`);
}

function checkEqual(id: string, values: string[], detail: string): ProductionResourceAuthorizationCheck {
  const compact = values.map((value) => String(value ?? ""));
  const ok = compact.every((value) => value && value === compact[0]);
  return checkBoolean(id, ok, "PRODUCTION_RESOURCE_CONFIG_MISMATCH", `${detail} values=${compact.join(",")}`);
}

function checkBoolean(id: string, ok: boolean, errorCode: string, detail: string): ProductionResourceAuthorizationCheck {
  return ok ? { id, status: "pass", detail } : blocked(id, errorCode, detail);
}

function blocked(id: string, errorCode: string, detail: string): ProductionResourceAuthorizationCheck {
  return { id, status: "blocked", errorCode, detail };
}

function isTestResourceName(value: string) {
  return /^contentforge-it-[a-z0-9-]+$/.test(value);
}

function isRealAccountId(value: string) {
  return /^[a-f0-9]{32}$/i.test(value.trim()) && !/^0+$/.test(value.trim());
}

function readGitClean() {
  const result = spawnSync("git", ["status", "--porcelain"], { cwd: projectRoot, encoding: "utf8", windowsHide: true });
  return result.status === 0 && result.stdout.trim() === "";
}

function readConfigSnapshot(): ConfigSnapshot {
  const wranglerPath = path.join(projectRoot, "wrangler.jsonc");
  const starterPath = path.join(projectRoot, "starter.site.json");
  const wrangler = existsSync(wranglerPath) ? JSON.parse(stripJsonComments(readFileSync(wranglerPath, "utf8"))) as Record<string, unknown> : {};
  const starter = existsSync(starterPath) ? JSON.parse(readFileSync(starterPath, "utf8")) as Record<string, unknown> : {};
  const d1 = Array.isArray(wrangler.d1_databases) ? wrangler.d1_databases[0] as Record<string, unknown> : {};
  const r2 = Array.isArray(wrangler.r2_buckets) ? wrangler.r2_buckets[0] as Record<string, unknown> : {};
  const vars = isRecord(wrangler.vars) ? wrangler.vars : {};
  return {
    workerName: String(wrangler.name ?? ""),
    d1DatabaseName: String(d1.database_name ?? ""),
    d1DatabaseId: String(d1.database_id ?? ""),
    r2BucketName: String(r2.bucket_name ?? ""),
    siteUrl: String(vars.NEXT_PUBLIC_SITE_URL ?? ""),
    r2PublicBaseUrl: String(vars.R2_PUBLIC_BASE_URL ?? ""),
    starterWorkerName: String(starter.cloudflareWorkerName ?? ""),
    starterD1DatabaseName: String(starter.d1DatabaseName ?? ""),
    starterD1DatabaseId: String(starter.d1DatabaseId ?? ""),
    starterR2BucketName: String(starter.r2BucketName ?? ""),
    starterSiteUrl: String(starter.productionUrl ?? starter.siteUrl ?? ""),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}
