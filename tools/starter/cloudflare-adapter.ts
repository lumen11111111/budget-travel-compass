import { runWrangler, runWranglerCommand } from "./wrangler";
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { CloudflareAdapterMode, CloudflarePermission } from "./cloudflare-execution";
import { validateProductionAuthorizationEvidence, type ProductionAuthorizationEvidence } from "./production-resource-authorization";
import {
  parseWranglerD1Execute,
  parseWranglerD1Create,
  parseWranglerDeploy,
  parseWranglerD1List,
  parseWranglerR2BucketCreate,
  parseWranglerR2BucketList,
  parseWranglerSecretPut,
  parseWranglerSecretList,
  parseWranglerWhoami,
  type ParseResult,
} from "./cloudflare-wrangler-output";

export type AdapterResult<T = unknown> = {
  ok: boolean;
  status:
    | "pass"
    | "blocked"
    | "action-required"
    | "manual-action"
    | "fail"
    | "skip"
    | "unsupported"
    | "permission-denied"
    | "command-failed"
    | "parse-failed"
    | "timeout"
    | "interactive-prompt"
    | "not-found"
    | "conflict"
    | "unknown";
  resource?: T;
  rawSummary: string;
  warnings: string[];
  errorCode?: string;
  errorMessage?: string;
  retryable: boolean;
};

export type AuthStatus = {
  authenticated: boolean;
  accountId?: string;
  accounts: Array<{ id: string; name: string }>;
  status: "authenticated" | "missing" | "unknown" | "partial";
  detail: string;
};

export type WorkerResource = { name: string; id?: string; accountId?: string; metadata?: Record<string, string> };
export type D1Resource = { name: string; id: string; accountId?: string; migrationVersion?: string; tables?: string[]; articlesCount?: number };
export type R2Resource = { name: string; accountId?: string; metadata?: Record<string, string> };
export type SecretStatus = { name: "ADMIN_PASSWORD" | "SESSION_SECRET"; status: "configured" | "missing" | "unknown" };

export interface ControlledCloudflareAdapter {
  mode: CloudflareAdapterMode;
  readonly callLog: string[];
  getWranglerVersion(): Promise<AdapterResult<string>>;
  getAuthStatus(): Promise<AdapterResult<AuthStatus>>;
  getPermissions(accountId: string): Promise<AdapterResult<CloudflarePermission[]>>;
  listWorkers(accountId: string): Promise<AdapterResult<WorkerResource[]>>;
  listD1Databases(accountId: string): Promise<AdapterResult<D1Resource[]>>;
  listR2Buckets(accountId: string): Promise<AdapterResult<R2Resource[]>>;
  listWorkerSecrets(accountId: string, workerName: string): Promise<AdapterResult<SecretStatus[]>>;
  putWorkerSecret(accountId: string, workerName: string, secretName: SecretStatus["name"], secretValue: string, productionAuthorization?: ProductionAuthorizationEvidence): Promise<AdapterResult<SecretStatus>>;
  deployWorker(accountId: string, workerName: string, productionAuthorization?: ProductionAuthorizationEvidence): Promise<AdapterResult<WorkerResource>>;
  createD1Database(accountId: string, name: string, productionAuthorization?: ProductionAuthorizationEvidence): Promise<AdapterResult<D1Resource>>;
  executeD1(accountId: string, databaseId: string, sql: string, productionAuthorization?: ProductionAuthorizationEvidence): Promise<AdapterResult<{ migrationVersion?: string; articlesCount: number }>>;
  createR2Bucket(accountId: string, name: string, productionAuthorization?: ProductionAuthorizationEvidence): Promise<AdapterResult<R2Resource>>;
  putR2Object(accountId: string, bucketName: string, key: string, content: string, productionAuthorization?: ProductionAuthorizationEvidence): Promise<AdapterResult<{ key: string }>>;
  getR2Object(accountId: string, bucketName: string, key: string, productionAuthorization?: ProductionAuthorizationEvidence): Promise<AdapterResult<{ key: string; body: string }>>;
  deleteR2Object(accountId: string, bucketName: string, key: string, productionAuthorization?: ProductionAuthorizationEvidence): Promise<AdapterResult<{ key: string }>>;
}

type FixtureInput = {
  auth?: AuthStatus;
  permissions?: CloudflarePermission[];
  workers?: WorkerResource[];
  d1?: D1Resource[];
  r2?: R2Resource[];
  secrets?: SecretStatus[];
  failNext?: string;
};

export function createControlledAdapter(mode: CloudflareAdapterMode, fixture: FixtureInput = {}): ControlledCloudflareAdapter {
  if (mode === "wrangler") return new WranglerAdapter();
  return new FixtureAdapter(mode, fixture);
}

class FixtureAdapter implements ControlledCloudflareAdapter {
  readonly callLog: string[] = [];
  private r2Objects = new Map<string, string>();
  private workers: WorkerResource[];
  private d1: D1Resource[];
  private r2: R2Resource[];

  constructor(
    public mode: "offline" | "mock",
    private fixture: FixtureInput,
  ) {
    this.workers = [...(fixture.workers ?? [])];
    this.d1 = [...(fixture.d1 ?? [])];
    this.r2 = [...(fixture.r2 ?? [])];
  }

  async getWranglerVersion() {
    this.callLog.push("getWranglerVersion");
    return ok("offline wrangler version unavailable", this.mode === "mock" ? "mock-wrangler" : "offline");
  }

  async getAuthStatus() {
    this.callLog.push("getAuthStatus");
    const fallbackAuth: AuthStatus = {
      authenticated: this.mode === "mock",
      accountId: this.mode === "mock" ? "mock-account" : undefined,
      accounts: this.mode === "mock" ? [{ id: "mock-account", name: "Mock Account" }] : [],
      status: this.mode === "mock" ? "authenticated" : "unknown",
      detail: `${this.mode} adapter does not contact Cloudflare.`,
    };
    return ok(
      `${this.mode} adapter does not contact Cloudflare`,
      this.fixture.auth ?? fallbackAuth,
    );
  }

  async getPermissions() {
    this.callLog.push("getPermissions");
    return ok("fixture permissions", this.fixture.permissions ?? []);
  }

  async listWorkers() {
    this.callLog.push("listWorkers");
    return ok("fixture workers", [...this.workers]);
  }

  async listD1Databases() {
    this.callLog.push("listD1Databases");
    return ok("fixture d1 databases", [...this.d1]);
  }

  async listR2Buckets() {
    this.callLog.push("listR2Buckets");
    return ok("fixture r2 buckets", [...this.r2]);
  }

  async listWorkerSecrets() {
    this.callLog.push("listWorkerSecrets");
    return ok("fixture secret names", this.fixture.secrets ?? []);
  }

  async putWorkerSecret(_accountId: string, _workerName: string, secretName: SecretStatus["name"], secretValue: string) {
    this.callLog.push(`putWorkerSecret:${secretName}:stdin`);
    const injected = this.takeFailure<SecretStatus>("putWorkerSecret");
    if (injected) return injected;
    if (!secretValue) return fail("EMPTY_SECRET", "Secret value was empty.");
    return ok("secret configured through stdin", { name: secretName, status: "configured" as const });
  }

  async deployWorker(_accountId: string, workerName: string) {
    this.callLog.push("deployWorker");
    const injected = this.takeFailure<WorkerResource>("deployWorker");
    if (injected) return injected;
    if (!this.workers.some((worker) => worker.name === workerName)) this.workers.push({ name: workerName });
    return ok("worker deployed", { name: workerName });
  }

  async createD1Database(accountId: string, name: string) {
    this.callLog.push("createD1Database");
    const injected = this.takeFailure<D1Resource>("createD1Database");
    if (injected) return injected;
    const existing = this.d1.find((database) => database.name === name);
    if (existing) return ok("d1 database reused", existing, ["D1 database already existed in fixture state."]);
    const resource = { name, id: deterministicFixtureId("d1", name), accountId };
    this.d1.push(resource);
    return ok("d1 created", resource);
  }

  async executeD1(_accountId: string, _databaseId: string, _sql: string) {
    this.callLog.push("executeD1");
    const injected = this.takeFailure<{ migrationVersion?: string; articlesCount: number }>("executeD1");
    if (injected) return injected;
    return ok("d1 migration applied", { migrationVersion: "001", articlesCount: 0 });
  }

  async createR2Bucket(accountId: string, name: string) {
    this.callLog.push("createR2Bucket");
    const injected = this.takeFailure<R2Resource>("createR2Bucket");
    if (injected) return injected;
    const existing = this.r2.find((bucket) => bucket.name === name);
    if (existing) return ok("r2 bucket reused", existing, ["R2 bucket already existed in fixture state."]);
    const resource = { name, accountId };
    this.r2.push(resource);
    return ok("r2 bucket created", resource);
  }

  async putR2Object(_accountId: string, bucketName: string, key: string, content: string) {
    this.callLog.push("putR2Object");
    this.r2Objects.set(`${bucketName}/${key}`, content);
    return ok("r2 object uploaded", { key });
  }

  async getR2Object(_accountId: string, bucketName: string, key: string) {
    this.callLog.push("getR2Object");
    const body = this.r2Objects.get(`${bucketName}/${key}`);
    return body === undefined ? fail("R2_NOT_FOUND", "Probe object was not readable.") : ok("r2 object read", { key, body });
  }

  async deleteR2Object(_accountId: string, bucketName: string, key: string) {
    this.callLog.push("deleteR2Object");
    this.r2Objects.delete(`${bucketName}/${key}`);
    return ok("r2 object deleted", { key });
  }

  private takeFailure<T>(operation: string): AdapterResult<T> | undefined {
    if (this.fixture.failNext !== operation) return undefined;
    this.fixture.failNext = undefined;
    return fail("FIXTURE_OPERATION_FAILED", `${operation} failed by fixture injection.`, true, "fail");
  }
}

class WranglerAdapter implements ControlledCloudflareAdapter {
  mode = "wrangler" as const;
  readonly callLog: string[] = [];

  async getWranglerVersion() {
    this.callLog.push("getWranglerVersion");
    const result = await runWranglerCommand({ args: ["--version"] });
    if (!result.ok) return fail("WRANGLER_VERSION_FAILED", result.stderr || result.stdout || "Wrangler version failed.", true, statusFromErrorCode(result.errorCode));
    return ok(`wrangler version (${result.source}${result.localPinned ? ", pinned" : ""})`, sanitizeOutput(result.stdout.trim()));
  }

  async getAuthStatus() {
    this.callLog.push("getAuthStatus");
    const result = await runWranglerCommand({ args: ["whoami"] });
    const parsed = parseWranglerWhoami(result);
    if (!parsed.ok) {
      const authStatus: AuthStatus["status"] = parsed.code === "WRANGLER_AUTH_FAILED" ? "missing" : "unknown";
      return {
        ok: parsed.code !== "WRANGLER_AUTH_FAILED",
        status: statusFromErrorCode(parsed.code),
        rawSummary: parsed.message,
        warnings: parsed.evidence ? [parsed.evidence] : [],
        retryable: true,
        errorCode: parsed.code,
        errorMessage: parsed.message,
        resource: {
          authenticated: false,
          accounts: [],
          status: authStatus,
          detail: parsed.evidence ?? parsed.message,
        },
      };
    }
    return ok("wrangler authenticated", {
      authenticated: parsed.value.authenticated,
      accounts: parsed.value.accounts,
      accountId: parsed.value.selectedAccountId,
      status: parsed.warnings.length ? "partial" as const : "authenticated" as const,
      detail: parsed.value.detail,
    }, parsed.warnings);
  }

  async getPermissions(accountId: string) {
    this.callLog.push("getPermissions");
    const result = await runWranglerCommand({ args: ["whoami"], accountId });
    const parsed = parseWranglerWhoami(result, accountId);
    if (!parsed.ok) return fail(parsed.code, parsed.evidence ? `${parsed.message}: ${parsed.evidence}` : parsed.message, true, statusFromErrorCode(parsed.code));
    const selectedMissing = parsed.warnings.some((warning) => warning.includes("was not found"));
    const warnings = [...parsed.warnings, "Wrangler does not expose stable fine-grained permission scopes here; read permissions are verified by read commands."];
    const status: AdapterResult["status"] = selectedMissing ? "action-required" : "pass";
    return {
      ...ok("wrangler account authenticated; fine-grained permission scopes unavailable", [] as CloudflarePermission[], warnings),
      status,
    };
  }

  async listWorkers() {
    this.callLog.push("listWorkers");
    return fail("WRANGLER_WORKER_LIST_UNSUPPORTED", "Wrangler 4.105.0 does not expose a stable account-wide Worker list command through this adapter.", false, "unsupported");
  }

  async listD1Databases(accountId: string) {
    this.callLog.push("listD1Databases");
    const result = await runWranglerCommand({ args: ["d1", "list", "--json"], accountId });
    const parsed = parseWranglerD1List(result);
    return parseToAdapterResult(parsed, "D1 list read from Wrangler.", (items) => items.map((item) => ({ name: item.name, id: item.id, accountId, migrationVersion: item.version })));
  }

  async listR2Buckets(accountId: string) {
    this.callLog.push("listR2Buckets");
    const help = await runWranglerCommand({ args: ["r2", "bucket", "list", "--help"], accountId });
    const supportsJson = help.ok && /--json\b/.test(`${help.stdout}\n${help.stderr}`);
    const result = await runWranglerCommand({ args: supportsJson ? ["r2", "bucket", "list", "--json"] : ["r2", "bucket", "list"], accountId });
    const parsed = parseWranglerR2BucketList(result);
    const warnings = supportsJson ? [] : ["Wrangler r2 bucket list --json is unavailable; parsed command-specific text output."];
    return parseToAdapterResult(parsed, "R2 bucket list read from Wrangler.", (items) => items.map((item) => ({ name: item.name, accountId, metadata: { creationDate: item.creationDate ?? "", location: item.location ?? "" } })), warnings);
  }

  async listWorkerSecrets(accountId: string, workerName: string) {
    this.callLog.push("listWorkerSecrets");
    const result = await runWranglerCommand({ args: ["secret", "list", "--name", workerName, "--format", "json"], accountId });
    const parsed = parseWranglerSecretList(result);
    return parseToAdapterResult(parsed, "Worker secret names read from Wrangler.", (items) =>
      items
        .filter((item) => item.name === "ADMIN_PASSWORD" || item.name === "SESSION_SECRET")
        .map((item) => ({ name: item.name as SecretStatus["name"], status: "configured" as const })),
    );
  }

  async putWorkerSecret(accountId: string, workerName: string, secretName: SecretStatus["name"], secretValue: string, productionAuthorization?: ProductionAuthorizationEvidence) {
    this.callLog.push(`putWorkerSecret:${secretName}:stdin`);
    if (!secretValue) return fail("EMPTY_SECRET", "Secret value was empty.");
    const gate = realWriteGate<SecretStatus>(accountId, workerName, "secret", productionAuthorization);
    if (gate) return gate;
    return runSecretPut(accountId, workerName, secretName, secretValue);
  }

  async deployWorker(accountId: string, workerName: string, productionAuthorization?: ProductionAuthorizationEvidence) {
    this.callLog.push("deployWorker");
    const gate = realWriteGate<WorkerResource>(accountId, workerName, "deploy", productionAuthorization);
    if (gate) return gate;
    const result = await runWranglerCommand({ args: ["deploy", "--name", workerName], accountId, timeoutMs: 120_000 });
    const parsed = parseWranglerDeploy(result, workerName);
    if (!parsed.ok) {
      if (result.ok && /^contentforge-it-[a-z0-9-]+$/.test(workerName) && /WRANGLER_DEPLOY_(?:WRONG_WORKER_NAME|MISSING_WORKER_NAME)/.test(parsed.code)) {
        return ok("worker deploy command exited successfully with approved --name", { name: workerName, accountId }, [
          "Deploy output did not expose stable Worker identity; follow-up secret write and cleanup verify the approved Worker name.",
        ]);
      }
      return fail(parsed.code, parsed.evidence ? `${parsed.message}: ${parsed.evidence}` : parsed.message, true, statusFromErrorCode(parsed.code));
    }
    return ok("worker deployed through wrangler", {
      name: parsed.value.workerName,
      accountId,
      id: parsed.value.deploymentId ?? parsed.value.versionId,
      metadata: {
        versionId: parsed.value.versionId ?? "",
        deploymentId: parsed.value.deploymentId ?? "",
        url: parsed.value.url ?? "",
        deployedAt: parsed.value.deployedAt ?? "",
      },
    }, parsed.warnings);
  }

  async createD1Database(accountId: string, name: string, productionAuthorization?: ProductionAuthorizationEvidence) {
    this.callLog.push("createD1Database");
    const gate = realWriteGate<D1Resource>(accountId, name, "create", productionAuthorization);
    if (gate) return gate;
    const before = await this.listD1Databases(accountId);
    if (!before.ok) return adapterFailure<D1Resource>(before);
    const existing = before.resource?.find((database) => database.name === name);
    if (existing) return ok("d1 database reused after list verification", existing, ["D1 database already exists; no create command was run."]);
    const help = await runWranglerCommand({ args: ["d1", "create", "--help"], accountId });
    const supportsJson = help.ok && /--json\b/.test(`${help.stdout}\n${help.stderr}`);
    const args = ["d1", "create", name, "--update-config=false"];
    if (supportsJson) args.push("--json");
    const created = await runWranglerCommand({ args, accountId });
    const parsed = parseWranglerD1Create(created);
    if (!parsed.ok) return fail(parsed.code, parsed.evidence ? `${parsed.message}: ${parsed.evidence}` : parsed.message, true, statusFromErrorCode(parsed.code));
    const after = await this.listD1Databases(accountId);
    if (!after.ok) return adapterFailure<D1Resource>(after);
    const verified = after.resource?.find((database) => database.name === parsed.value.name && database.id === parsed.value.id);
    if (!verified) return fail("WRANGLER_D1_CREATE_VERIFY_FAILED", "D1 create succeeded but re-read did not verify the same database id.", true, "fail");
    return ok("d1 created and verified", verified, parsed.warnings);
  }

  async executeD1(accountId: string, databaseId: string, sql: string, productionAuthorization?: ProductionAuthorizationEvidence) {
    this.callLog.push("executeD1");
    const gate = realWriteGate<{ migrationVersion?: string; articlesCount: number }>(accountId, databaseId, "d1", productionAuthorization);
    if (gate) return gate;
    const statementCount = sql.split(";").map((statement) => statement.trim()).filter(Boolean).length;
    const useFile = statementCount > 1 || sql.length > 1000;
    const tempDir = path.join(process.cwd(), ".contentforge", "tmp");
    let filePath = "";
    if (useFile) {
      mkdirSync(tempDir, { recursive: true });
      filePath = path.join(tempDir, `d1-${Date.now().toString(36)}.sql`);
      writeFileSync(filePath, sql, "utf8");
    }
    const args = useFile ? ["d1", "execute", databaseId, "--remote", "--file", filePath, "--json"] : ["d1", "execute", databaseId, "--remote", "--command", sql, "--json"];
    const result = await runWranglerCommand({ args, accountId, timeoutMs: 120_000 });
    if (filePath && existsSync(filePath)) unlinkSync(filePath);
    const parsed = parseWranglerD1Execute(result);
    if (!parsed.ok) return fail(parsed.code, parsed.message, true, statusFromErrorCode(parsed.code));
    if (!parsed.value.success) return fail("WRANGLER_D1_EXECUTE_FAILED", "D1 execute reported failure.", true);
    return ok("d1 sql executed through wrangler", { migrationVersion: "phase4", articlesCount: parsed.value.rowsWritten ?? 0 }, parsed.warnings);
  }

  async createR2Bucket(accountId: string, name: string, productionAuthorization?: ProductionAuthorizationEvidence) {
    this.callLog.push("createR2Bucket");
    const gate = realWriteGate<R2Resource>(accountId, name, "create", productionAuthorization);
    if (gate) return gate;
    const before = await this.listR2Buckets(accountId);
    if (!before.ok) return adapterFailure<R2Resource>(before);
    const existing = before.resource?.find((bucket) => bucket.name === name);
    if (existing) return ok("r2 bucket reused after list verification", existing, ["R2 bucket already exists; no create command was run."]);
    const help = await runWranglerCommand({ args: ["r2", "bucket", "create", "--help"], accountId });
    const supportsJson = help.ok && /--json\b/.test(`${help.stdout}\n${help.stderr}`);
    const created = await runWranglerCommand({ args: supportsJson ? ["r2", "bucket", "create", name, "--json"] : ["r2", "bucket", "create", name], accountId });
    const parsed = parseWranglerR2BucketCreate(created, name);
    if (!parsed.ok) return fail(parsed.code, parsed.message, true, statusFromErrorCode(parsed.code));
    const after = await this.listR2Buckets(accountId);
    if (!after.ok) return adapterFailure<R2Resource>(after);
    const verified = after.resource?.find((bucket) => bucket.name === parsed.value.name);
    if (!verified) return fail("WRANGLER_R2_CREATE_VERIFY_FAILED", "R2 create succeeded but re-read did not verify the bucket.", true, "fail");
    return ok("r2 bucket created and verified", verified, parsed.warnings);
  }

  async putR2Object(accountId: string, bucketName: string, key: string, content: string, productionAuthorization?: ProductionAuthorizationEvidence) {
    this.callLog.push("putR2Object");
    const gate = realWriteGate<{ key: string }>(accountId, bucketName, "r2", productionAuthorization);
    if (gate) return gate;
    if (!isProbeKey(key)) return fail("R2_PROBE_KEY_BLOCKED", "R2 probe key must be under .contentforge-probe/<operationId>.txt.", false, "blocked");
    const tempDir = path.join(process.cwd(), ".contentforge", "tmp");
    mkdirSync(tempDir, { recursive: true });
    const filePath = path.join(tempDir, `${Buffer.from(key).toString("hex")}.txt`);
    writeFileSync(filePath, content, "utf8");
    try {
      const result = await runWranglerCommand({ args: ["r2", "object", "put", `${bucketName}/${key}`, "--remote", "--file", filePath, "--content-type", "text/plain"], accountId, timeoutMs: 120_000 });
      if (!result.ok) return fail(result.errorCode ?? "WRANGLER_R2_OBJECT_PUT_FAILED", result.stderr || result.stdout || "R2 object put failed.", true, statusFromErrorCode(result.errorCode));
      return ok("r2 probe object uploaded", { key });
    } finally {
      if (existsSync(filePath)) unlinkSync(filePath);
    }
  }

  async getR2Object(accountId: string, bucketName: string, key: string, productionAuthorization?: ProductionAuthorizationEvidence) {
    this.callLog.push("getR2Object");
    const gate = realWriteGate<{ key: string; body: string }>(accountId, bucketName, "r2", productionAuthorization);
    if (gate) return gate;
    if (!isProbeKey(key)) return fail("R2_PROBE_KEY_BLOCKED", "R2 probe key must be under .contentforge-probe/<operationId>.txt.", false, "blocked");
    const tempDir = path.join(process.cwd(), ".contentforge", "tmp");
    mkdirSync(tempDir, { recursive: true });
    const filePath = path.join(tempDir, `${Buffer.from(key).toString("hex")}.read.txt`);
    if (existsSync(filePath)) unlinkSync(filePath);
    const result = await runWranglerCommand({ args: ["r2", "object", "get", `${bucketName}/${key}`, "--remote", "--file", filePath], accountId, timeoutMs: 120_000 });
    if (!result.ok) {
      if (isAbsent(`${result.stdout}\n${result.stderr}`)) return fail("R2_OBJECT_NOT_FOUND", "R2 object was not found.", false, "not-found");
      return fail(result.errorCode ?? "WRANGLER_R2_OBJECT_GET_FAILED", result.stderr || result.stdout || "R2 object get failed.", true, statusFromErrorCode(result.errorCode));
    }
    const body = existsSync(filePath) ? readFileSync(filePath, "utf8") : result.stdout;
    if (existsSync(filePath)) unlinkSync(filePath);
    return ok("r2 probe object read", { key, body });
  }

  async deleteR2Object(accountId: string, bucketName: string, key: string, productionAuthorization?: ProductionAuthorizationEvidence) {
    this.callLog.push("deleteR2Object");
    const gate = realWriteGate<{ key: string }>(accountId, bucketName, "r2", productionAuthorization);
    if (gate) return gate;
    if (!isProbeKey(key)) return fail("R2_PROBE_KEY_BLOCKED", "R2 probe key must be under .contentforge-probe/<operationId>.txt.", false, "blocked");
    const result = await runWranglerCommand({ args: ["r2", "object", "delete", `${bucketName}/${key}`, "--remote", "--force"], accountId, timeoutMs: 120_000 });
    if (!result.ok && !isAbsent(`${result.stdout}\n${result.stderr}`)) return fail(result.errorCode ?? "WRANGLER_R2_OBJECT_DELETE_FAILED", result.stderr || result.stdout || "R2 object delete failed.", true, statusFromErrorCode(result.errorCode));
    return ok("r2 probe object deleted", { key });
  }
}

function runSecretPut(accountId: string, workerName: string, secretName: SecretStatus["name"], secretValue: string): Promise<AdapterResult<SecretStatus>> {
  return runWranglerCommand({ args: ["secret", "put", secretName, "--name", workerName], accountId, stdin: secretValue }).then((result) => {
    const parsed = parseWranglerSecretPut(result, secretName);
    if (parsed.ok) return ok("secret configured through stdin", { name: secretName, status: "configured" as const }, parsed.warnings);
    return fail(parsed.code, parsed.message, true, statusFromErrorCode(parsed.code));
  });
}

function ok<T>(rawSummary: string, resource: T, warnings: string[] = []): AdapterResult<T> {
  return { ok: true, status: "pass", resource, rawSummary: sanitizeOutput(rawSummary), warnings: warnings.map(sanitizeOutput), retryable: false };
}

function fail<T = never>(errorCode: string, errorMessage: string, retryable = false, status: AdapterResult["status"] = "fail"): AdapterResult<T> {
  return {
    ok: false,
    status,
    rawSummary: sanitizeOutput(errorMessage),
    warnings: [],
    errorCode,
    errorMessage: sanitizeOutput(errorMessage),
    retryable,
  };
}

function parseToAdapterResult<TInput, TOutput>(
  parsed: ParseResult<TInput>,
  successSummary: string,
  mapValue: (value: TInput) => TOutput,
  extraWarnings: string[] = [],
): AdapterResult<TOutput> {
  if (!parsed.ok) return fail(parsed.code, parsed.message, true, statusFromErrorCode(parsed.code));
  return ok(successSummary, mapValue(parsed.value), [...extraWarnings, ...parsed.warnings]);
}

function statusFromErrorCode(errorCode = ""): AdapterResult["status"] {
  if (/UNSUPPORTED/.test(errorCode)) return "unsupported";
  if (/PERMISSION|AUTH/.test(errorCode)) return "permission-denied";
  if (/TIMEOUT/.test(errorCode)) return "timeout";
  if (/INTERACTIVE_PROMPT/.test(errorCode)) return "interactive-prompt";
  if (/PARSE|MISSING_FIELDS|FORMAT|JSON/.test(errorCode)) return "parse-failed";
  if (/NOT_FOUND/.test(errorCode)) return "not-found";
  if (/CONFLICT/.test(errorCode)) return "conflict";
  if (/COMMAND|SPAWN|VERSION/.test(errorCode)) return "command-failed";
  return "unknown";
}

function adapterFailure<T>(result: AdapterResult<unknown>): AdapterResult<T> {
  return {
    ok: false,
    status: result.status,
    rawSummary: result.rawSummary,
    warnings: result.warnings,
    errorCode: result.errorCode,
    errorMessage: result.errorMessage,
    retryable: result.retryable,
  };
}

function realWriteGate<T>(accountId: string, resourceName: string, operation: "create" | "deploy" | "secret" | "d1" | "r2" = "create", productionAuthorization?: ProductionAuthorizationEvidence): AdapterResult<T> | undefined {
  const enabled = process.env.CONTENTFORGE_ENABLE_REAL_CLOUDFLARE_WRITES === "1";
  const operationEnabled =
    operation === "create" ||
    (operation === "deploy" && process.env.CONTENTFORGE_ENABLE_REAL_WORKER_DEPLOY === "1") ||
    (operation === "secret" && process.env.CONTENTFORGE_ENABLE_REAL_SECRET_WRITES === "1") ||
    (operation === "d1" && process.env.CONTENTFORGE_ENABLE_REAL_D1_WRITES === "1") ||
    (operation === "r2" && process.env.CONTENTFORGE_ENABLE_REAL_R2_WRITES === "1");
  const safeName = /^contentforge-it-[a-z0-9-]+$/.test(resourceName);
  const d1IdWithProductionAuthorization = operation === "d1" && /^[0-9a-f-]{36}$/i.test(resourceName) && productionAuthorization;
  if (enabled && operationEnabled && accountId && safeName) return undefined;
  if (enabled && operationEnabled && accountId && (productionAuthorization || d1IdWithProductionAuthorization)) {
    if (process.env.CONTENTFORGE_ENABLE_PRODUCTION_RESOURCE_WRITES !== "1") {
      return fail("PRODUCTION_RESOURCE_ENV_GATE_MISSING", "Production resource writes require CONTENTFORGE_ENABLE_PRODUCTION_RESOURCE_WRITES=1.", false, "blocked");
    }
    const evidence = validateProductionAuthorizationEvidence({ evidence: productionAuthorization, accountId, resourceName, operation });
    if (!evidence.ok) return fail(evidence.code, evidence.message, false, "blocked");
    return undefined;
  }
  return fail(
    "REAL_CLOUDFLARE_WRITE_GATE_BLOCKED",
    "Real Cloudflare writes require exact ContentForge env gates, an explicit account id, and a contentforge-it- test resource name.",
    false,
    "blocked",
  );
}

function isProbeKey(key: string) {
  return /^\.contentforge-probe\/[a-z0-9-]+\.txt$/i.test(key) && !key.includes("..");
}

function isAbsent(output: string) {
  return /not found|does not exist|couldn't find|specified object does not exist|NoSuchKey/i.test(output);
}

function deterministicFixtureId(kind: string, name: string) {
  const hex = Buffer.from(`${kind}:${name}`).toString("hex").padEnd(32, "0").slice(0, 32);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

export function sanitizeOutput(value: string) {
  return value
    .replace(/(Bearer\s+)[A-Za-z0-9._-]+/g, "$1***")
    .replace(/(Authorization:\s*)[^\r\n]+/gi, "$1***")
    .replace(/(CONTENTFORGE_ADMIN_PASSWORD\s*=\s*)[^\s]+/g, "$1***");
}
