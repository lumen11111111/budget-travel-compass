import crypto from "node:crypto";

export type CloudflareAdapterMode = "offline" | "mock" | "wrangler";
export type RiskLevel = 0 | 1 | 2 | 3 | 4;
export type OperationStepState =
  | "planned"
  | "remote-confirmed"
  | "executing"
  | "remote-succeeded"
  | "local-patch-succeeded"
  | "verified"
  | "failed";
export type ResourceOwnership = "missing" | "owned" | "explicitly-reused" | "ambiguous" | "foreign" | "inaccessible";
export type OperationResultStatus = "passed" | "blocked" | "action-required" | "manual-action" | "failed" | "skipped";
export type CloudflarePermission =
  | "workers:read"
  | "workers:write"
  | "d1:read"
  | "d1:write"
  | "r2:read"
  | "r2:write"
  | "secrets:write"
  | "dns:read"
  | "dns:write"
  | "domain:write";

export type AllowFlags = {
  allowCreateWorker: boolean;
  allowCreateD1: boolean;
  allowCreateR2: boolean;
  allowSetSecrets: boolean;
  allowDeploy: boolean;
  allowD1Write: boolean;
  allowR2Probe: boolean;
  allowConfigPatch: boolean;
  allowBootstrapSeed: boolean;
  allowCleanup: boolean;
  allowDomainChange: boolean;
  allowDnsChange: boolean;
};

export type RemoteExecutionOptions = {
  adapterMode: CloudflareAdapterMode;
  remote: boolean;
  remotePlan: boolean;
  remoteCheck: boolean;
  execute: boolean;
  resume: boolean;
  recoverConfigPatch?: boolean;
  rollbackConfigPatch?: boolean;
  operationId?: string;
  yes: boolean;
  dryRun: boolean;
  accountId: string;
  approvedPlanHash?: string;
  reuseWorker?: string;
  reuseD1?: string;
  reuseR2?: string;
  allowProductionResources: boolean;
  allowFlags: AllowFlags;
};

export type CloudflareResource = {
  id?: string;
  name: string;
  accountId?: string;
  metadata?: Record<string, string>;
};

export type OperationTarget = {
  accountId: string;
  resourceType: "worker" | "d1" | "r2" | "secret" | "deploy" | "domain" | "dns" | "local-config";
  resourceName: string;
  resourceId?: string;
  action: string;
};

export type OperationPlan = OperationTarget & {
  stepId: string;
  operationId: string;
  operationKey: string;
  riskLevel: RiskLevel;
  ownership: ResourceOwnership;
  requiredAllowFlags: Array<keyof AllowFlags>;
  state: OperationStepState;
  targetSummary: string;
  planHash: string;
  previousState: string;
  resultingState: string;
};

export type OperationDecision = {
  status: OperationResultStatus;
  riskLevel: RiskLevel;
  message: string;
  missingAllowFlags: Array<keyof AllowFlags>;
  retryable: boolean;
};

export const defaultAllowFlags: AllowFlags = {
  allowCreateWorker: false,
  allowCreateD1: false,
  allowCreateR2: false,
  allowSetSecrets: false,
  allowDeploy: false,
  allowD1Write: false,
  allowR2Probe: false,
  allowConfigPatch: false,
  allowBootstrapSeed: false,
  allowCleanup: false,
  allowDomainChange: false,
  allowDnsChange: false,
};

export function parseAdapterMode(value: string | undefined): CloudflareAdapterMode {
  if (!value || value === "offline") return "offline";
  if (value === "mock" || value === "wrangler") return value;
  throw new Error(`Invalid Cloudflare adapter: ${value}`);
}

export function parseRemoteExecutionArgs(args: string[]): RemoteExecutionOptions {
  const options: RemoteExecutionOptions = {
    adapterMode: "offline",
    remote: false,
    remotePlan: false,
    remoteCheck: false,
    execute: false,
    resume: false,
    yes: false,
    dryRun: false,
    accountId: "",
    allowProductionResources: false,
    allowFlags: { ...defaultAllowFlags },
  };

  for (const arg of args) {
    if (arg === "--remote") options.remote = true;
    else if (arg === "--remote-plan") options.remotePlan = true;
    else if (arg === "--remote-check") options.remoteCheck = true;
    else if (arg === "--execute") options.execute = true;
    else if (arg === "--resume") options.resume = true;
    else if (arg === "--recover-config-patch") options.recoverConfigPatch = true;
    else if (arg === "--rollback-config-patch") options.rollbackConfigPatch = true;
    else if (arg === "--yes") options.yes = true;
    else if (arg === "--dry-run") options.dryRun = true;
    else if (arg === "--allow-create-worker" || arg === "--allow-worker-create") options.allowFlags.allowCreateWorker = true;
    else if (arg === "--allow-create-d1" || arg === "--allow-d1-create") options.allowFlags.allowCreateD1 = true;
    else if (arg === "--allow-create-r2" || arg === "--allow-r2-create") options.allowFlags.allowCreateR2 = true;
    else if (arg === "--allow-set-secrets" || arg === "--allow-secret-write") options.allowFlags.allowSetSecrets = true;
    else if (arg === "--allow-deploy") options.allowFlags.allowDeploy = true;
    else if (arg === "--allow-d1-write" || arg === "--allow-d1-execute") options.allowFlags.allowD1Write = true;
    else if (arg === "--allow-r2-probe") options.allowFlags.allowR2Probe = true;
    else if (arg === "--allow-config-patch") options.allowFlags.allowConfigPatch = true;
    else if (arg === "--allow-bootstrap-seed") options.allowFlags.allowBootstrapSeed = true;
    else if (arg === "--allow-cleanup") options.allowFlags.allowCleanup = true;
    else if (arg === "--allow-domain-change") options.allowFlags.allowDomainChange = true;
    else if (arg === "--allow-dns-change") options.allowFlags.allowDnsChange = true;
    else if (arg === "--allow-production-resources") options.allowProductionResources = true;
    else if (arg.startsWith("--adapter=")) options.adapterMode = parseAdapterMode(arg.slice("--adapter=".length));
    else if (arg.startsWith("--account-id=")) options.accountId = arg.slice("--account-id=".length).trim();
    else if (arg.startsWith("--approved-plan-hash=")) options.approvedPlanHash = arg.slice("--approved-plan-hash=".length).trim();
    else if (arg.startsWith("--operation-id=")) options.operationId = arg.slice("--operation-id=".length).trim();
    else if (arg.startsWith("--reuse-worker=")) options.reuseWorker = arg.slice("--reuse-worker=".length).trim();
    else if (arg.startsWith("--reuse-d1=")) options.reuseD1 = arg.slice("--reuse-d1=".length).trim();
    else if (arg.startsWith("--reuse-r2=")) options.reuseR2 = arg.slice("--reuse-r2=".length).trim();
  }

  return options;
}

export function operationKey(input: Omit<OperationPlan, "operationKey" | "operationId" | "planHash" | "targetSummary" | "state">) {
  return [
    input.stepId,
    input.accountId || "no-account",
    input.resourceType,
    input.resourceId || input.resourceName,
    input.action,
  ].join(":");
}

export function createOperationPlan(input: Omit<OperationPlan, "operationKey" | "operationId" | "planHash" | "targetSummary" | "state">): OperationPlan {
  const key = operationKey(input);
  const targetSummary = `${input.resourceType}:${input.resourceName}${input.resourceId ? `/${input.resourceId}` : ""}`;
  const operationId = crypto.createHash("sha256").update(`${key}:${input.riskLevel}`).digest("hex").slice(0, 16);
  const withoutHash = { ...input, operationKey: key, operationId, targetSummary, state: "planned" as const };
  return {
    ...withoutHash,
    planHash: hashPlan(withoutHash),
  };
}

export function hashPlan(plan: Omit<OperationPlan, "planHash">) {
  return crypto.createHash("sha256").update(stableJson(plan)).digest("hex");
}

export function decideOperation(plan: OperationPlan, options: RemoteExecutionOptions): OperationDecision {
  if (options.dryRun || options.remotePlan || options.remoteCheck || options.remote) {
    return {
      status: "skipped",
      riskLevel: plan.riskLevel,
      message: "Read-only mode; no remote or local write operation will run.",
      missingAllowFlags: [],
      retryable: false,
    };
  }
  if (!options.execute) {
    return {
      status: "blocked",
      riskLevel: plan.riskLevel,
      message: "Write operation requires --execute.",
      missingAllowFlags: [],
      retryable: false,
    };
  }
  if (plan.riskLevel >= 1 && !options.accountId) {
    return {
      status: "blocked",
      riskLevel: plan.riskLevel,
      message: "Remote operation requires --account-id.",
      missingAllowFlags: [],
      retryable: false,
    };
  }
  if (["ambiguous", "foreign", "inaccessible"].includes(plan.ownership)) {
    return {
      status: "blocked",
      riskLevel: plan.riskLevel,
      message: `Resource ownership is ${plan.ownership}.`,
      missingAllowFlags: [],
      retryable: false,
    };
  }
  const missingAllowFlags = plan.requiredAllowFlags.filter((flag) => !options.allowFlags[flag]);
  if (missingAllowFlags.length > 0) {
    return {
      status: "blocked",
      riskLevel: plan.riskLevel,
      message: `Missing allow flag(s): ${missingAllowFlags.join(", ")}`,
      missingAllowFlags,
      retryable: false,
    };
  }
  return {
    status: "passed",
    riskLevel: plan.riskLevel,
    message: "Operation is authorized.",
    missingAllowFlags: [],
    retryable: false,
  };
}

export function determineOwnership(input: {
  desiredName: string;
  desiredId?: string;
  accountId?: string;
  explicitReuse?: string;
  matches: CloudflareResource[];
}): ResourceOwnership {
  if (input.matches.length === 0) return "missing";
  if (input.matches.length > 1) return "ambiguous";
  const match = input.matches[0];
  if (!match) return "missing";
  if (input.explicitReuse && [match.name, match.id].includes(input.explicitReuse)) return "explicitly-reused";
  if (input.desiredId && match.id && input.desiredId !== match.id) return "foreign";
  if (input.accountId && match.accountId && input.accountId !== match.accountId) return "foreign";
  if (match.metadata?.contentforge === "owned" || match.name === input.desiredName) return "owned";
  return "ambiguous";
}

export function requireRuntimeAdminPassword(env: Record<string, string | undefined> = process.env) {
  const value = env.CONTENTFORGE_ADMIN_PASSWORD;
  if (!value) throw new Error("CONTENTFORGE_ADMIN_PASSWORD is required for ADMIN_PASSWORD secret setup.");
  return value;
}

export function generateSessionSecret() {
  return crypto.randomBytes(32).toString("base64url");
}

export function safeSecretStatus(name: "ADMIN_PASSWORD" | "SESSION_SECRET", status: "configured" | "missing" | "unknown") {
  return { name, status };
}

export function assertNoExplicitTransactionSql(sql: string) {
  if (/\b(begin|commit|rollback)\b/i.test(sql)) {
    throw new Error("Remote D1 execution must not send explicit transaction SQL.");
  }
}

export function r2ProbeKey(operationId: string) {
  return `.contentforge-probe/${operationId}.txt`;
}

export function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, entry]) => `${JSON.stringify(key)}:${stableJson(entry)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}
