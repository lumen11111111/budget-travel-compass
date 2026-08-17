import { sanitizeOutput } from "./cloudflare-adapter";
import type { WranglerCommandResult } from "./wrangler";

export type WranglerOutputInput = {
  version: string;
  command: string;
  args: string[];
  exitCode: number;
  stdout: string;
  stderr: string;
  durationMs: number;
};

export type WranglerParsedEvidence = {
  wranglerVersion: string;
  command: string;
  arguments: string[];
  exitCode: number;
  durationMs: number;
  jsonParsed: boolean;
  stderrSummary: string;
  retryable: boolean;
  parsedResourceId?: string;
  parsedResourceName?: string;
  status: "parsed" | "blocked" | "failed";
  errorCode?: string;
};

export type ParseResult<T> =
  | { ok: true; value: T; warnings: string[] }
  | { ok: false; code: string; message: string; evidence?: string };

export type CloudflareD1Database = {
  id: string;
  name: string;
  createdAt?: string;
  version?: string;
};

export type CloudflareR2Bucket = {
  name: string;
  creationDate?: string;
  location?: string;
};

export type CloudflareWorker = {
  name: string;
  modifiedAt?: string;
  createdAt?: string;
  etag?: string;
};

export type CloudflareSecretName = {
  name: "ADMIN_PASSWORD" | "SESSION_SECRET" | string;
  type?: string;
};

export type CloudflareDeployResult = {
  workerName: string;
  versionId?: string;
  deploymentId?: string;
  url?: string;
  deployedAt?: string;
};

export type CloudflareD1ExecuteResult = {
  success: boolean;
  rowsRead?: number;
  rowsWritten?: number;
  durationMs?: number;
};

export type WranglerWhoamiInfo = {
  authenticated: boolean;
  accounts: Array<{ id: string; name: string }>;
  selectedAccountId?: string;
  detail: string;
};

const promptPatterns = [
  /\bpress enter\b/i,
  /\bconfirm\b/i,
  /\bare you sure\b/i,
  /\bselect an account\b/i,
  /\bpassword\b/i,
  /\blog in\b/i,
];

export function parseWranglerOutput(input: WranglerOutputInput): WranglerParsedEvidence {
  const stdout = sanitizeOutput(input.stdout);
  const stderr = sanitizeOutput(input.stderr);
  const base = {
    wranglerVersion: input.version,
    command: input.command,
    arguments: sanitizeArgs(input.args),
    exitCode: input.exitCode,
    durationMs: input.durationMs,
    stderrSummary: summarize(stderr),
    retryable: input.exitCode !== 0,
  };

  if (promptPatterns.some((pattern) => pattern.test(`${stdout}\n${stderr}`))) {
    return { ...base, jsonParsed: false, status: "blocked", errorCode: "WRANGLER_INTERACTIVE_PROMPT" };
  }
  if (!stdout.trim() && !stderr.trim()) {
    return { ...base, jsonParsed: false, status: "failed", errorCode: "WRANGLER_EMPTY_OUTPUT" };
  }
  if (/\[truncated\]|truncated output/i.test(`${stdout}\n${stderr}`)) {
    return { ...base, jsonParsed: false, status: "failed", errorCode: "WRANGLER_TRUNCATED_OUTPUT" };
  }
  if (input.exitCode !== 0) {
    return { ...base, jsonParsed: false, status: "failed", errorCode: "WRANGLER_NON_ZERO_EXIT" };
  }

  const json = parseJson(stdout);
  if (json) {
    const resource = normalizeResource(json);
    if (!resource.name || !resource.id) {
      return { ...base, jsonParsed: true, status: "failed", errorCode: "WRANGLER_JSON_MISSING_FIELDS" };
    }
    return { ...base, jsonParsed: true, status: "parsed", retryable: false, parsedResourceId: resource.id, parsedResourceName: resource.name };
  }

  const text = parseText(stdout);
  if (text.name && text.id) {
    return { ...base, jsonParsed: false, status: "parsed", retryable: false, parsedResourceId: text.id, parsedResourceName: text.name };
  }

  return { ...base, jsonParsed: false, status: "failed", errorCode: "WRANGLER_UNKNOWN_OUTPUT" };
}

export function parseWranglerWhoami(result: WranglerCommandResult, selectedAccountId = ""): ParseResult<WranglerWhoamiInfo> {
  const preflight = commandPreflight(result);
  if (!preflight.ok) return preflight;
  const output = clean(`${result.stdout}\n${result.stderr}`);
  const accounts = parseAccountRows(output);
  const selectedFound = selectedAccountId ? accounts.some((account) => account.id === selectedAccountId) || output.includes(selectedAccountId) : undefined;
  return {
    ok: true,
    value: {
      authenticated: true,
      accounts,
      selectedAccountId: selectedFound ? selectedAccountId : undefined,
      detail: summarize(output) || "Authenticated.",
    },
    warnings: selectedAccountId && !selectedFound ? [`Selected account ${selectedAccountId} was not found in wrangler whoami output.`] : [],
  };
}

export function parseWranglerD1List(result: WranglerCommandResult): ParseResult<CloudflareD1Database[]> {
  const preflight = commandPreflight(result);
  if (!preflight.ok) return preflight;
  const parsed = parseJsonFromOutput(result.stdout);
  if (!parsed.ok) return parsed;
  const rows = extractArrayPayload(parsed.value);
  if (!rows.ok) return rows;
  const databases: CloudflareD1Database[] = [];
  const invalid: string[] = [];
  rows.value.forEach((row, index) => {
    const id = stringValue(row.id) ?? stringValue(row.uuid) ?? stringValue(row.database_id);
    const name = stringValue(row.name) ?? stringValue(row.database_name);
    if (!id || !name) {
      invalid.push(`record ${index} missing id or name`);
      return;
    }
    databases.push({
      id,
      name,
      createdAt: stringValue(row.created_at) ?? stringValue(row.createdAt),
      version: stringValue(row.version),
    });
  });
  if (invalid.length > 0 && databases.length === 0) {
    return { ok: false, code: "WRANGLER_D1_LIST_MISSING_FIELDS", message: "D1 list output did not contain any valid database records.", evidence: invalid.join("; ") };
  }
  return { ok: true, value: databases, warnings: invalid };
}

export function parseWranglerD1Create(result: WranglerCommandResult): ParseResult<CloudflareD1Database> {
  const preflight = commandPreflight(result);
  if (!preflight.ok) return preflight;
  const parsed = parseJsonFromOutput(result.stdout);
  if (!parsed.ok) {
    const text = parseD1CreateText(result.stdout || result.stderr);
    if (text.ok) return text;
    return parsed;
  }
  const source = firstRecordPayload(parsed.value);
  if (!source.ok) return { ok: false, code: "WRANGLER_D1_CREATE_PARSE_FAILED", message: source.message, evidence: source.evidence };
  const id = stringValue(source.value.id) ?? stringValue(source.value.uuid) ?? stringValue(source.value.database_id);
  const name = stringValue(source.value.name) ?? stringValue(source.value.database_name);
  if (!id || !name) {
    const text = parseD1CreateText(result.stdout || result.stderr);
    if (text.ok) return text;
  }
  if (!id) return { ok: false, code: "WRANGLER_D1_CREATE_MISSING_ID", message: "D1 create output did not contain a database id.", evidence: summarize(result.stdout || result.stderr) };
  if (!name) return { ok: false, code: "WRANGLER_D1_CREATE_MISSING_NAME", message: "D1 create output did not contain a database name.", evidence: summarize(result.stdout || result.stderr) };
  return {
    ok: true,
    value: {
      id,
      name,
      createdAt: stringValue(source.value.created_at) ?? stringValue(source.value.createdAt),
      version: stringValue(source.value.version),
    },
    warnings: parsed.warnings,
  };
}

function parseD1CreateText(output: string): ParseResult<CloudflareD1Database> {
  const text = clean(output);
  const id = text.match(/["']?database_id["']?\s*[:=]\s*["']([^"']+)["']/i)?.[1] ?? text.match(/\bID:\s*([a-f0-9-]{32,36})\b/i)?.[1];
  const name = text.match(/["']?database_name["']?\s*[:=]\s*["']([^"']+)["']/i)?.[1] ?? text.match(/\bname:\s*([a-z0-9][a-z0-9-]*)\b/i)?.[1];
  if (!id || !name) return { ok: false, code: "WRANGLER_D1_CREATE_PARSE_FAILED", message: "D1 create text output did not contain database_name and database_id.", evidence: summarize(text) };
  return { ok: true, value: { id, name }, warnings: ["Parsed command-specific D1 create text output."] };
}

export function parseWranglerR2BucketList(result: WranglerCommandResult): ParseResult<CloudflareR2Bucket[]> {
  const preflight = commandPreflight(result);
  if (!preflight.ok) return preflight;
  const json = parseJsonFromOutput(result.stdout);
  if (json.ok) return normalizeR2Rows(json.value);
  const textRows = parseR2TextRows(result.stdout);
  if (textRows.ok) return textRows;
  return { ok: false, code: "WRANGLER_R2_LIST_PARSE_FAILED", message: "R2 bucket list output was not recognized as stable JSON or a known text table.", evidence: summarize(result.stdout || result.stderr) };
}

export function parseWranglerR2BucketCreate(result: WranglerCommandResult, expectedName = ""): ParseResult<CloudflareR2Bucket> {
  const preflight = commandPreflight(result);
  if (!preflight.ok) return preflight;
  const json = parseJsonFromOutput(result.stdout);
  if (json.ok) {
    const source = firstRecordPayload(json.value);
    if (!source.ok) return { ok: false, code: "WRANGLER_R2_CREATE_PARSE_FAILED", message: source.message, evidence: source.evidence };
    const name = stringValue(source.value.name) ?? stringValue(source.value.bucket_name);
    if (!name) {
      const textRows = parseR2CreateText(result.stdout || result.stderr, expectedName);
      if (textRows.ok) return textRows;
    }
    if (!name) return { ok: false, code: "WRANGLER_R2_CREATE_MISSING_NAME", message: "R2 create output did not contain a bucket name.", evidence: summarize(result.stdout || result.stderr) };
    return {
      ok: true,
      value: {
        name,
        creationDate: stringValue(source.value.creation_date) ?? stringValue(source.value.creationDate) ?? stringValue(source.value.created_at),
        location: stringValue(source.value.location) ?? stringValue(source.value.jurisdiction),
      },
      warnings: json.warnings,
    };
  }

  return parseR2CreateText(`${result.stdout}\n${result.stderr}`, expectedName);
}

function parseR2CreateText(outputValue: string, expectedName = ""): ParseResult<CloudflareR2Bucket> {
  const output = clean(outputValue);
  const explicitName = output.match(/["']?bucket_name["']?\s*[:=]\s*["']([^"']+)["']/i)?.[1] ?? output.match(/\b(?:bucket|name):\s*([a-z0-9][a-z0-9.-]*)/i)?.[1];
  const quotedName = output.match(/bucket\s+["']([a-z0-9][a-z0-9.-]*)["']/i)?.[1];
  const name = explicitName ?? quotedName;
  if (!name) return { ok: false, code: "WRANGLER_R2_CREATE_PARSE_FAILED", message: "R2 create text output did not contain a bucket name.", evidence: summarize(output) };
  if (expectedName && name !== expectedName) {
    return { ok: false, code: "WRANGLER_R2_CREATE_NAME_MISMATCH", message: "R2 create output bucket name did not match the requested name.", evidence: summarize(output) };
  }
  return { ok: true, value: { name }, warnings: ["Parsed command-specific R2 create text output."] };
}

export function parseWranglerWorkerList(result: WranglerCommandResult): ParseResult<CloudflareWorker[]> {
  const preflight = commandPreflight(result);
  if (!preflight.ok) return preflight;
  const json = parseJsonFromOutput(result.stdout);
  if (!json.ok) {
    return { ok: false, code: "WRANGLER_WORKER_LIST_UNSUPPORTED", message: "Wrangler worker account-wide list output is unsupported by this parser.", evidence: summarize(result.stdout || result.stderr) };
  }
  const rows = extractArrayPayload(json.value);
  if (!rows.ok) return { ok: false, code: "WRANGLER_WORKER_LIST_PARSE_FAILED", message: rows.message, evidence: rows.evidence };
  const workers: CloudflareWorker[] = [];
  const invalid: string[] = [];
  rows.value.forEach((row, index) => {
    const name = stringValue(row.name) ?? stringValue(row.worker_name) ?? stringValue(row.id);
    if (!name) {
      invalid.push(`record ${index} missing name`);
      return;
    }
    workers.push({
      name,
      modifiedAt: stringValue(row.modified_on) ?? stringValue(row.modifiedAt),
      createdAt: stringValue(row.created_on) ?? stringValue(row.createdAt),
      etag: stringValue(row.etag),
    });
  });
  if (invalid.length > 0 && workers.length === 0) return { ok: false, code: "WRANGLER_WORKER_LIST_MISSING_FIELDS", message: "Worker list output did not contain any valid worker records.", evidence: invalid.join("; ") };
  return { ok: true, value: workers, warnings: invalid };
}

export function parseWranglerSecretList(result: WranglerCommandResult): ParseResult<CloudflareSecretName[]> {
  const preflight = commandPreflight(result);
  if (!preflight.ok) return preflight;
  const json = parseJsonFromOutput(result.stdout);
  if (!json.ok) {
    return { ok: false, code: "WRANGLER_SECRET_LIST_UNSUPPORTED", message: "Wrangler secret list output was not stable JSON.", evidence: summarize(result.stdout || result.stderr) };
  }
  const rows = extractArrayPayload(json.value);
  if (!rows.ok) return { ok: false, code: "WRANGLER_SECRET_LIST_PARSE_FAILED", message: rows.message, evidence: rows.evidence };
  const secrets: CloudflareSecretName[] = [];
  const invalid: string[] = [];
  rows.value.forEach((row, index) => {
    const name = stringValue(row.name) ?? stringValue(row.secret_name);
    if (!name) {
      invalid.push(`record ${index} missing name`);
      return;
    }
    secrets.push({ name, type: stringValue(row.type) });
  });
  if (invalid.length > 0 && secrets.length === 0) return { ok: false, code: "WRANGLER_SECRET_LIST_MISSING_FIELDS", message: "Secret list output did not contain any valid secret name records.", evidence: invalid.join("; ") };
  return { ok: true, value: secrets, warnings: invalid };
}

export function parseWranglerDeploy(result: WranglerCommandResult, expectedWorkerName = ""): ParseResult<CloudflareDeployResult> {
  const preflight = commandPreflight(result);
  if (!preflight.ok) return preflight;
  const output = clean(`${result.stdout}\n${result.stderr}`);
  const json = parseJsonFromOutput(result.stdout);
  if (json.ok) {
    const source = firstRecordPayload(json.value);
    if (!source.ok) return { ok: false, code: "WRANGLER_DEPLOY_PARSE_FAILED", message: source.message, evidence: source.evidence };
    const workerName = stringValue(source.value.name) ?? stringValue(source.value.worker_name) ?? stringValue(source.value.script_name);
    if (!workerName || (expectedWorkerName && workerName !== expectedWorkerName)) {
      const text = parseDeployText(output, expectedWorkerName);
      if (text.ok) return text;
    }
    if (!workerName) return { ok: false, code: "WRANGLER_DEPLOY_MISSING_WORKER_NAME", message: "Deploy output did not contain a Worker name.", evidence: summarize(output) };
    if (expectedWorkerName && workerName !== expectedWorkerName) return { ok: false, code: "WRANGLER_DEPLOY_WRONG_WORKER_NAME", message: "Deploy output Worker name did not match the approved plan.", evidence: summarize(output) };
    return {
      ok: true,
      value: {
        workerName,
        versionId: stringValue(source.value.version_id) ?? stringValue(source.value.versionId),
        deploymentId: stringValue(source.value.deployment_id) ?? stringValue(source.value.deploymentId) ?? stringValue(source.value.id),
        url: stringValue(source.value.url) ?? stringValue(source.value.deployment_url),
        deployedAt: stringValue(source.value.created_on) ?? stringValue(source.value.deployedAt),
      },
      warnings: json.warnings,
    };
  }

  return parseDeployText(output, expectedWorkerName);
}

function parseDeployText(output: string, expectedWorkerName = ""): ParseResult<CloudflareDeployResult> {
  const workerName = output.match(/\b(?:worker|script|name):\s*([a-z0-9][a-z0-9-]*)/i)?.[1] ?? output.match(/Uploaded\s+([a-z0-9][a-z0-9-]*)/i)?.[1] ?? output.match(/Deployed\s+([a-z0-9][a-z0-9-]*)\s+triggers/i)?.[1];
  const versionId = output.match(/\b(?:version|version id|version_id):\s*([a-zA-Z0-9_-]+)/i)?.[1];
  const deploymentId = output.match(/\b(?:deployment|deployment id|deployment_id):\s*([a-zA-Z0-9_-]+)/i)?.[1];
  const url = output.match(/https:\/\/[^\s)]+/i)?.[0];
  if (!workerName) return { ok: false, code: "WRANGLER_DEPLOY_MISSING_WORKER_NAME", message: "Deploy text output did not contain a Worker name.", evidence: summarize(output) };
  if (expectedWorkerName && workerName !== expectedWorkerName) return { ok: false, code: "WRANGLER_DEPLOY_WRONG_WORKER_NAME", message: "Deploy output Worker name did not match the approved plan.", evidence: summarize(output) };
  if (!versionId && !deploymentId && !url) return { ok: false, code: "WRANGLER_DEPLOY_VERIFICATION_FIELDS_MISSING", message: "Deploy output lacked version, deployment id, or URL evidence.", evidence: summarize(output) };
  return { ok: true, value: { workerName, versionId, deploymentId, url }, warnings: ["Parsed command-specific deploy text output."] };
}

export function parseWranglerSecretPut(result: WranglerCommandResult, secretName: string): ParseResult<CloudflareSecretName> {
  const preflight = commandPreflight(result);
  if (!preflight.ok) return preflight;
  const output = clean(`${result.stdout}\n${result.stderr}`);
  if (/secret/i.test(output) && /(uploaded|created|updated|success|put)/i.test(output)) {
    return { ok: true, value: { name: secretName }, warnings: [] };
  }
  return { ok: false, code: "WRANGLER_SECRET_PUT_PARSE_FAILED", message: "Secret put output did not match a known success shape.", evidence: summarize(output) };
}

export function parseWranglerD1Execute(result: WranglerCommandResult): ParseResult<CloudflareD1ExecuteResult> {
  const successfulImport = parseD1ExecuteSuccessFromText(`${result.stdout}\n${result.stderr}`);
  if (successfulImport.ok) return successfulImport;
  const preflight = commandPreflight(result);
  if (!preflight.ok) return preflight;
  const json = parseJsonFromOutput(result.stdout);
  if (json.ok) {
    const arrayRecord = Array.isArray(json.value) && isRecord(json.value[0]) ? json.value[0] : undefined;
    if (arrayRecord) {
      const meta = isRecord(arrayRecord.meta) ? arrayRecord.meta : {};
      const success = Boolean(arrayRecord.success ?? arrayRecord.ok ?? true);
      return {
        ok: true,
        value: {
          success,
          rowsRead: numberValue(arrayRecord.rows_read) ?? numberValue(arrayRecord.rowsRead) ?? numberValue(meta.rows_read) ?? numberValue(meta.rowsRead),
          rowsWritten: numberValue(arrayRecord.rows_written) ?? numberValue(arrayRecord.rowsWritten) ?? numberValue(arrayRecord.changes) ?? numberValue(meta.rows_written) ?? numberValue(meta.rowsWritten) ?? numberValue(meta.changes),
          durationMs: numberValue(arrayRecord.duration_ms) ?? numberValue(arrayRecord.durationMs) ?? numberValue(meta.duration) ?? numberValue(meta.duration_ms),
        },
        warnings: json.warnings,
      };
    }
    const source = firstRecordPayload(json.value);
    if (source.ok) {
      const success = Boolean(source.value.success ?? source.value.ok ?? true);
      return {
        ok: true,
        value: {
          success,
          rowsRead: numberValue(source.value.rows_read) ?? numberValue(source.value.rowsRead),
          rowsWritten: numberValue(source.value.rows_written) ?? numberValue(source.value.rowsWritten) ?? numberValue(source.value.changes),
          durationMs: numberValue(source.value.duration_ms) ?? numberValue(source.value.durationMs),
        },
        warnings: json.warnings,
      };
    }
  }
  const output = clean(`${result.stdout}\n${result.stderr}`);
  if (/(executed|success|completed)/i.test(output) && !/(error|failed)/i.test(output)) return { ok: true, value: { success: true }, warnings: ["Parsed command-specific D1 execute text output."] };
  return { ok: false, code: "WRANGLER_D1_EXECUTE_PARSE_FAILED", message: "D1 execute output did not match a known success shape.", evidence: summarize(output) };
}

function parseD1ExecuteSuccessFromText(outputValue: string): ParseResult<CloudflareD1ExecuteResult> {
  const output = clean(outputValue);
  if (!/"success"\s*:\s*true/i.test(output) && !/\bsuccess:\s*true/i.test(output)) {
    return { ok: false, code: "WRANGLER_D1_EXECUTE_PARSE_FAILED", message: "D1 execute output did not contain success true.", evidence: summarize(output) };
  }
  return {
    ok: true,
    value: {
      success: true,
      rowsRead: numericText(output.match(/"rows_read"\s*:\s*(\d+)/i)?.[1]),
      rowsWritten: numericText(output.match(/"rows_written"\s*:\s*(\d+)/i)?.[1]),
      durationMs: numericText(output.match(/"duration"\s*:\s*([0-9.]+)/i)?.[1]),
    },
    warnings: ["Parsed D1 execute success from mixed Wrangler output."],
  };
}

function numericText(value: string | undefined) {
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function sanitizeArgs(args: string[]) {
  return args.map((arg) => (/(secret|token|password|authorization)/i.test(arg) ? "***" : sanitizeOutput(arg)));
}

function summarize(value: string) {
  const clean = value.replace(/\s+/g, " ").trim();
  if (clean.length <= 180) return clean;
  return `${clean.slice(0, 180)}...`;
}

function clean(value: string) {
  return sanitizeOutput(value).replace(/\r/g, "").trim();
}

function commandPreflight(result: WranglerCommandResult): ParseResult<true> {
  if (result.timedOut) return { ok: false, code: "WRANGLER_COMMAND_TIMEOUT", message: "Wrangler command timed out.", evidence: summarize(result.stderr || result.stdout) };
  if (result.interactivePromptDetected) return { ok: false, code: "WRANGLER_INTERACTIVE_PROMPT", message: "Wrangler command requested interactive input.", evidence: summarize(result.stderr || result.stdout) };
  if (result.exitCode !== 0) {
    const output = `${result.stdout}\n${result.stderr}`;
    const code = /not found/i.test(output) ? "WRANGLER_NOT_FOUND" : /permission|forbidden|not authorized|unauthorized/i.test(output) ? "WRANGLER_PERMISSION_DENIED" : /not logged in|log in|authentication/i.test(output) ? "WRANGLER_AUTH_FAILED" : "WRANGLER_COMMAND_FAILED";
    return { ok: false, code, message: "Wrangler command failed.", evidence: summarize(output) };
  }
  if (!result.stdout.trim() && !result.stderr.trim()) return { ok: false, code: "WRANGLER_EMPTY_OUTPUT", message: "Wrangler command returned empty output." };
  if (/\[truncated\]|truncated output/i.test(`${result.stdout}\n${result.stderr}`)) return { ok: false, code: "WRANGLER_TRUNCATED_OUTPUT", message: "Wrangler output was truncated.", evidence: summarize(`${result.stdout}\n${result.stderr}`) };
  return { ok: true, value: true, warnings: [] };
}

function parseJsonFromOutput(output: string): ParseResult<unknown> {
  const cleanOutput = clean(output);
  if (!cleanOutput) return { ok: false, code: "WRANGLER_JSON_EMPTY", message: "No JSON output was present." };
  try {
    return { ok: true, value: JSON.parse(cleanOutput) as unknown, warnings: [] };
  } catch {
    const extracted = extractJsonCandidate(cleanOutput);
    if (!extracted) return { ok: false, code: "WRANGLER_JSON_PARSE_FAILED", message: "Wrangler output was not parseable JSON.", evidence: summarize(cleanOutput) };
    try {
      return { ok: true, value: JSON.parse(extracted) as unknown, warnings: ["Ignored non-JSON output around JSON payload."] };
    } catch {
      return { ok: false, code: "WRANGLER_JSON_PARSE_FAILED", message: "Wrangler JSON payload could not be parsed.", evidence: summarize(cleanOutput) };
    }
  }
}

function extractJsonCandidate(value: string) {
  for (let start = 0; start < value.length; start += 1) {
    const open = value[start];
    if (open !== "{" && open !== "[") continue;
    const close = open === "{" ? "}" : "]";
    let depth = 0;
    let inString = false;
    let escaped = false;
    for (let index = start; index < value.length; index += 1) {
      const char = value[index];
      if (char === "\\" && inString) {
        escaped = !escaped;
        continue;
      }
      if (char === "\"" && !escaped) inString = !inString;
      if (!inString && char === open) depth += 1;
      if (!inString && char === close) depth -= 1;
      if (depth === 0) return value.slice(start, index + 1);
      if (char !== "\\") escaped = false;
    }
  }
  return "";
}

function extractArrayPayload(value: unknown): ParseResult<Record<string, unknown>[]> {
  if (Array.isArray(value)) return { ok: true, value: value.filter(isRecord), warnings: [] };
  if (!isRecord(value)) return { ok: false, code: "WRANGLER_JSON_NOT_OBJECT_OR_ARRAY", message: "Expected JSON object or array.", evidence: summarize(JSON.stringify(value)) };
  const payload = value.result ?? value.results ?? value.items;
  if (Array.isArray(payload)) return { ok: true, value: payload.filter(isRecord), warnings: [] };
  return { ok: false, code: "WRANGLER_JSON_ARRAY_MISSING", message: "Expected result/results/items array in Wrangler output.", evidence: summarize(JSON.stringify(value)) };
}

function firstRecordPayload(value: unknown): ParseResult<Record<string, unknown>> {
  if (isRecord(value)) {
    if (isRecord(value.result)) return { ok: true, value: value.result, warnings: [] };
    if (isRecord(value.database)) return { ok: true, value: value.database, warnings: [] };
    if (isRecord(value.bucket)) return { ok: true, value: value.bucket, warnings: [] };
    return { ok: true, value, warnings: [] };
  }
  if (Array.isArray(value) && isRecord(value[0])) return { ok: true, value: value[0], warnings: [] };
  return { ok: false, code: "WRANGLER_JSON_RECORD_MISSING", message: "Expected a JSON object record in Wrangler output.", evidence: summarize(JSON.stringify(value)) };
}

function normalizeR2Rows(value: unknown): ParseResult<CloudflareR2Bucket[]> {
  const rows = extractArrayPayload(value);
  if (!rows.ok) return rows;
  const buckets: CloudflareR2Bucket[] = [];
  const invalid: string[] = [];
  rows.value.forEach((row, index) => {
    const name = stringValue(row.name) ?? stringValue(row.bucket_name);
    if (!name) {
      invalid.push(`record ${index} missing name`);
      return;
    }
    buckets.push({
      name,
      creationDate: stringValue(row.creation_date) ?? stringValue(row.creationDate) ?? stringValue(row.created_at),
      location: stringValue(row.location) ?? stringValue(row.jurisdiction),
    });
  });
  if (invalid.length > 0 && buckets.length === 0) return { ok: false, code: "WRANGLER_R2_LIST_MISSING_FIELDS", message: "R2 list output did not contain any valid bucket records.", evidence: invalid.join("; ") };
  return { ok: true, value: buckets, warnings: invalid };
}

function parseR2TextRows(output: string): ParseResult<CloudflareR2Bucket[]> {
  const lines = clean(output).split(/\n/).map((line) => line.trim()).filter(Boolean);
  if (lines.length === 0) return { ok: true, value: [], warnings: [] };
  if (/no buckets|empty/i.test(lines.join(" "))) return { ok: true, value: [], warnings: [] };

  const nameRecords = lines.map((line) => line.match(/^name:\s+([a-z0-9][a-z0-9.-]*)$/i)?.[1]).filter((name): name is string => Boolean(name));
  if (nameRecords.length > 0 && nameRecords.length === lines.filter((line) => /^name:/i.test(line)).length) {
    return { ok: true, value: nameRecords.map((name) => ({ name })), warnings: ["Parsed legacy name-line R2 bucket output."] };
  }

  const headerIndex = lines.findIndex((line) => /\bname\b/i.test(line) && (/created|creation|location|jurisdiction/i.test(line) || /\s{2,}|\t/.test(line)));
  if (headerIndex >= 0) {
    const rows = lines.slice(headerIndex + 1).filter((line) => !/^[-\s|]+$/.test(line));
    const buckets = rows.map((line) => line.split(/\s{2,}|\t|\|/).map((part) => part.trim()).filter(Boolean)[0]).filter((name): name is string => Boolean(name && /^[a-z0-9][a-z0-9.-]*$/i.test(name)));
    if (buckets.length === rows.length) return { ok: true, value: buckets.map((name) => ({ name })), warnings: ["Parsed tabular R2 bucket output."] };
  }

  return { ok: false, code: "WRANGLER_R2_TEXT_PARSE_FAILED", message: "R2 text output did not match known stable shapes.", evidence: summarize(lines.join("\n")) };
}

function parseAccountRows(output: string) {
  const accounts = new Map<string, { id: string; name: string }>();
  for (const line of output.split(/\r?\n/)) {
    const match = line.match(/([a-f0-9]{32})/i);
    if (!match?.[1]) continue;
    const id = match[1];
    const name = line.replace(id, "").replace(/[|:]/g, " ").trim() || "Cloudflare Account";
    accounts.set(id, { id, name });
  }
  return [...accounts.values()];
}

function parseJson(value: string) {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return null;
  }
}

function normalizeResource(value: unknown): { id?: string; name?: string } {
  if (!isRecord(value)) return {};
  const source = isRecord(value.result) ? value.result : value;
  return {
    id: stringValue(source.id) ?? stringValue(source.uuid) ?? stringValue(source.database_id),
    name: stringValue(source.name) ?? stringValue(source.worker_name) ?? stringValue(source.bucket_name),
  };
}

function parseText(value: string) {
  return {
    id: value.match(/\b(?:id|database_id|version_id):\s*([a-zA-Z0-9_-]+)/i)?.[1],
    name: value.match(/\b(?:name|worker|bucket):\s*([a-z0-9-]+)/i)?.[1],
  };
}

function stringValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function numberValue(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

