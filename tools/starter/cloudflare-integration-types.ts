import type { AllowFlags, CloudflareAdapterMode } from "./cloudflare-execution";

export type IntegrationCleanupPolicy = "success-cleanup" | "failure-retain" | "failure-cleanup";
export type IntegrationVerdict =
  | "blocked"
  | "planned"
  | "mock-passed"
  | "real-passed"
  | "passed-with-cleanup-required"
  | "failed"
  | "interrupted";
export type IntegrationStepState = "planned" | "blocked" | "executing" | "succeeded" | "failed" | "skipped" | "cleanup-required" | "cleaned";

export type IntegrationOptions = {
  adapterMode: CloudflareAdapterMode;
  plan: boolean;
  integration: boolean;
  accountId: string;
  resourcePrefix: string;
  approvedPlanHash?: string;
  allowCleanup: boolean;
  retainOnFailure: boolean;
  cleanupOnFailure: boolean;
  cleanupOnly?: string;
  resume?: string;
  step?: string;
  timeoutSeconds: number;
  yes: boolean;
  allowFlags: AllowFlags;
};

export type IntegrationResourceKind = "worker" | "d1" | "r2" | "secret" | "deploy" | "r2-probe";

export type IntegrationResourceRecord = {
  kind: IntegrationResourceKind;
  accountId: string;
  operationId: string;
  resourceId: string;
  resourceName: string;
  resourcePrefix: string;
  stateBefore: "missing" | "present" | "unknown";
  createdByCurrentOperation: boolean;
  verifiedAfterCreate: boolean;
  cleanupEligible: boolean;
  hasUnexpectedBindings?: boolean;
};

export type IntegrationBaseline = {
  baselineSource: "offline" | "mock" | "wrangler";
  remoteVerified: boolean;
  workers: Array<{ name: string; id?: string }>;
  d1: Array<{ name: string; id?: string }>;
  r2: Array<{ name: string; id?: string }>;
  secretNames: string[];
};

export type IntegrationPlan = {
  operationId: string;
  accountId: string;
  resourcePrefix: string;
  workerName: string;
  d1Name: string;
  r2Name: string;
  steps: string[];
  allowFlags: AllowFlags & { allowCleanup: boolean };
  wranglerVersion: string;
  frameworkCommit: string;
  adapter: CloudflareAdapterMode;
  cleanupPolicy: IntegrationCleanupPolicy;
  retainOnFailure: boolean;
  cleanupOnFailure: boolean;
  startedBy: string;
  generatedAt: string;
  baselineHash: string;
};

export type IntegrationStepResult = {
  stepId: string;
  state: IntegrationStepState;
  summary: string;
  retryable: boolean;
};

export type IntegrationManifest = {
  frameworkCommit: string;
  nodeVersion: string;
  wranglerVersion: string;
  adapter: CloudflareAdapterMode;
  realCloudflareAccess: boolean;
  realResourcesCreated: boolean;
  accountId: string;
  operationId: string;
  integrationPlanHash: string;
  resourcePrefix: string;
  resourceNames: {
    worker: string;
    d1: string;
    r2: string;
  };
  resourceIds: Record<string, string>;
  cleanupPolicy: IntegrationCleanupPolicy;
  createdAt: string;
  cleanedAt?: string;
  stepResults: IntegrationStepResult[];
  retryableFailures: string[];
  cleanupStatus: "not-required" | "required" | "blocked" | "completed" | "skipped";
  finalVerdict: IntegrationVerdict;
  knownLimitations: string[];
  baseline: IntegrationBaseline;
};

export type IntegrationRunReport = {
  manifest: IntegrationManifest;
  resources: IntegrationResourceRecord[];
  checks: Array<{ id: string; status: "pass" | "blocked" | "warn" | "skip" | "fail"; detail: string }>;
  planHash: string;
  outputPath: string;
};

