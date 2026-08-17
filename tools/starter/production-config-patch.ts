import { closeSync, existsSync, mkdirSync, openSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";

import { projectRoot, stripJsonComments } from "./cli-utils";
import { sanitizeOutput } from "./cloudflare-adapter";
import { productionPatchesRelativeDir, sha256 } from "./production-patches";

export type ProductionResourcePatch = {
  operationId: string;
  executionPlanHash: string;
  accountId: string;
  adapter: string;
  workerName: string;
  d1DatabaseName: string;
  d1DatabaseId: string;
  r2BucketName: string;
  siteUrl: string;
  r2PublicBaseUrl?: string;
};

export type ConfigValidationResult = {
  ok: boolean;
  codes: string[];
  message: string;
};

export type PatchJournalEntry = {
  operationId: string;
  executionPlanHash: string;
  accountId: string;
  adapter: string;
  filePath: string;
  beforeHash: string;
  afterHash: string;
  backupPath: string;
  tempPath: string;
  patchFields: string[];
  startedAt: string;
  completedAt?: string;
  status: "started" | "written" | "rolled-back" | "rollback-blocked" | "failed";
  rollbackStatus: "available" | "blocked" | "applied" | "not-required";
  error?: string;
};

export type ConfigPatchResult = {
  ok: boolean;
  changedFiles: string[];
  journals: PatchJournalEntry[];
  validation: ConfigValidationResult;
  rollbackAvailable: boolean;
  errorCode?: string;
  message?: string;
  operationId: string;
  journalDir: string;
};

type PatchOptions = {
  root?: string;
  failAfterFirstWrite?: boolean;
};

const wranglerFile = "wrangler.jsonc";
const starterFile = "starter.site.json";
const placeholderUuid = "00000000-0000-0000-0000-000000000000";
const unfinishedStatuses = new Set(["started", "partially-written", "validation-failed", "rollback-required", "failed"]);

export function patchProductionConfig(patch: ProductionResourcePatch, options: PatchOptions = {}): ConfigPatchResult {
  const root = options.root ?? projectRoot;
  const operationId = patch.operationId;
  const journalDir = path.join(root, productionPatchesRelativeDir, operationId);
  const startedAt = new Date().toISOString();
  const pending = findUnfinishedProductionPatches(root).filter((item) => item.operationId !== operationId);
  if (pending.length > 0) {
    return failedResult(patch, [], validationError("PATCH_RECOVERY_REQUIRED", `Unfinished config patch journal exists: ${pending[0]?.operationId}`), "PATCH_RECOVERY_REQUIRED", journalDir);
  }
  const inputValidation = validatePatchInput(patch);
  if (!inputValidation.ok) return failedResult(patch, [], inputValidation, inputValidation.codes[0], journalDir);

  try {
    const wranglerPath = path.join(root, wranglerFile);
    const starterPath = path.join(root, starterFile);
    const wranglerBefore = readFileSync(wranglerPath, "utf8");
    const starterBefore = readFileSync(starterPath, "utf8");
    const wranglerAfter = patchWranglerJsonc(wranglerBefore, patch);
    const starterAfter = patchStarterJson(starterBefore, patch);
    const validation = validateProductionConfig({ wranglerContent: wranglerAfter, starterContent: starterAfter, patch });
    if (!validation.ok) return failedResult(patch, [], validation, validation.codes[0], journalDir);

    mkdirSync(journalDir, { recursive: true });
    writeFileSync(path.join(journalDir, "wrangler.before.jsonc"), wranglerBefore, "utf8");
    writeFileSync(path.join(journalDir, "wrangler.after.jsonc"), wranglerAfter, "utf8");
    writeFileSync(path.join(journalDir, "starter.before.json"), starterBefore, "utf8");
    writeFileSync(path.join(journalDir, "starter.after.json"), starterAfter, "utf8");

    const entries: PatchJournalEntry[] = [
      makeEntry({ patch, filePath: wranglerFile, before: wranglerBefore, after: wranglerAfter, patchFields: ["name", "d1_databases[0].binding", "d1_databases[0].database_name", "d1_databases[0].database_id", "r2_buckets[0].binding", "r2_buckets[0].bucket_name", "vars.NEXT_PUBLIC_SITE_URL", "vars.R2_PUBLIC_BASE_URL"], startedAt, journalDir, root }),
      makeEntry({ patch, filePath: starterFile, before: starterBefore, after: starterAfter, patchFields: ["cloudflareWorkerName", "d1DatabaseName", "d1DatabaseId", "r2BucketName", "productionUrl"], startedAt, journalDir, root }),
    ];
    writeManifest(journalDir, patch, entries, "started");

    try {
      atomicReplace(wranglerPath, wranglerAfter, entries[0]!.tempPath, root);
      entries[0]!.status = "written";
      if (options.failAfterFirstWrite) throw new Error("Injected failure after first config patch write.");
      atomicReplace(starterPath, starterAfter, entries[1]!.tempPath, root);
      entries[1]!.status = "written";
    } catch (error) {
      entries.forEach((entry) => {
        entry.error = sanitizeOutput(error instanceof Error ? error.message : "Patch write failed.");
      });
      writeManifest(journalDir, patch, entries, "rollback-required");
      const rollback = rollbackProductionConfig({ operationId, root });
      const code = rollback.ok ? "PATCH_WRITE_FAILED" : "ROLLBACK_FAILED";
      return failedResult(patch, rollback.journals, validationError(code, rollback.message ?? "Patch write failed and rollback was attempted."), code, journalDir);
    }

    const afterValidation = validateProductionConfig({
      wranglerContent: readFileSync(wranglerPath, "utf8"),
      starterContent: readFileSync(starterPath, "utf8"),
      patch,
    });
    if (!afterValidation.ok) {
      entries.forEach((entry) => {
        entry.status = "failed";
        entry.error = afterValidation.message;
      });
      writeManifest(journalDir, patch, entries, "rollback-required");
      const rollback = rollbackProductionConfig({ operationId, root });
      return failedResult(patch, rollback.journals, afterValidation, afterValidation.codes[0], journalDir);
    }

    const completedAt = new Date().toISOString();
    entries.forEach((entry) => {
      entry.completedAt = completedAt;
      entry.rollbackStatus = "available";
    });
    writeManifest(journalDir, patch, entries, "completed");
    return {
      ok: true,
      changedFiles: entries.filter((entry) => entry.beforeHash !== entry.afterHash).map((entry) => entry.filePath),
      journals: entries,
      validation: afterValidation,
      rollbackAvailable: true,
      operationId,
      journalDir: normalize(path.relative(root, journalDir)),
    };
  } catch (error) {
    return failedResult(patch, [], validationError("PATCH_WRITE_FAILED", sanitizeOutput(error instanceof Error ? error.message : "Patch failed.")), "PATCH_WRITE_FAILED", journalDir);
  }
}

export function validateProductionConfig(input: {
  wranglerContent: string;
  starterContent: string;
  patch: ProductionResourcePatch;
}): ConfigValidationResult {
  const errors: string[] = [];
  const wrangler = parseJsonc<Record<string, unknown>>(input.wranglerContent, "CONFIG_PARSE_FAILED", errors);
  const starter = parseJson<Record<string, unknown>>(input.starterContent, "CONFIG_PARSE_FAILED", errors);
  if (!wrangler || !starter) return validationError(errors[0] ?? "CONFIG_PARSE_FAILED", "Config parse failed.", errors);

  const d1 = arrayRecord(wrangler.d1_databases, "CONFIG_SCHEMA_MISMATCH", errors, "wrangler.d1_databases");
  const r2 = arrayRecord(wrangler.r2_buckets, "CONFIG_SCHEMA_MISMATCH", errors, "wrangler.r2_buckets");
  const vars = recordValue(wrangler.vars, "CONFIG_SCHEMA_MISMATCH", errors, "wrangler.vars");
  if (!d1 || !r2 || !vars) return validationError(errors[0] ?? "CONFIG_SCHEMA_MISMATCH", "Config schema mismatch.", errors);

  if (wrangler.name !== input.patch.workerName) errors.push("RESOURCE_NAME_MISMATCH");
  if (d1.binding !== "DB") errors.push("BINDING_MISMATCH");
  if (d1.database_name !== input.patch.d1DatabaseName) errors.push("RESOURCE_NAME_MISMATCH");
  if (!validUuid(String(d1.database_id ?? "")) || d1.database_id === placeholderUuid) errors.push("D1_ID_INVALID");
  if (d1.database_id !== input.patch.d1DatabaseId) errors.push("D1_ID_MISMATCH");
  if (r2.binding !== "MEDIA_BUCKET") errors.push("BINDING_MISMATCH");
  if (r2.bucket_name !== input.patch.r2BucketName) errors.push("RESOURCE_NAME_MISMATCH");
  if (vars.NEXT_PUBLIC_SITE_URL !== input.patch.siteUrl || !String(vars.NEXT_PUBLIC_SITE_URL).startsWith("https://")) errors.push("SITE_URL_MISMATCH");
  if (input.patch.r2PublicBaseUrl && vars.R2_PUBLIC_BASE_URL !== input.patch.r2PublicBaseUrl) errors.push("SITE_URL_MISMATCH");

  if (starter.cloudflareWorkerName !== input.patch.workerName) errors.push("RESOURCE_NAME_MISMATCH");
  if (starter.d1DatabaseName !== input.patch.d1DatabaseName) errors.push("RESOURCE_NAME_MISMATCH");
  if (starter.d1DatabaseId !== input.patch.d1DatabaseId) errors.push("D1_ID_MISMATCH");
  if (starter.r2BucketName !== input.patch.r2BucketName) errors.push("RESOURCE_NAME_MISMATCH");
  const starterUrl = String(starter.productionUrl ?? starter.siteUrl ?? "");
  if (starterUrl !== input.patch.siteUrl) errors.push("SITE_URL_MISMATCH");

  const unique = [...new Set(errors)];
  return unique.length ? validationError(unique[0]!, "Production config validation failed.", unique) : { ok: true, codes: [], message: "Production config validation passed." };
}

export function rollbackProductionConfig(input: { operationId: string; root?: string }): ConfigPatchResult {
  const root = input.root ?? projectRoot;
  const journalDir = path.join(root, productionPatchesRelativeDir, input.operationId);
  const manifestPath = path.join(journalDir, "manifest.json");
  if (!existsSync(manifestPath)) {
    return failedResult(emptyPatch(input.operationId), [], validationError("RECOVERY_INVALID_OPERATION_ID", "Patch journal was not found."), "RECOVERY_INVALID_OPERATION_ID", journalDir);
  }
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as { patch: ProductionResourcePatch; entries: PatchJournalEntry[]; status: string };
  const entries = manifest.entries;
  const blocked = entries.find((entry) => {
    const target = path.join(root, entry.filePath);
    const current = existsSync(target) ? readFileSync(target, "utf8") : "";
    return sha256(current) !== entry.afterHash && sha256(current) !== entry.beforeHash;
  });
  if (blocked) {
    blocked.rollbackStatus = "blocked";
    blocked.status = "rollback-blocked";
    writeManifest(journalDir, manifest.patch, entries, "rollback-blocked");
    return failedResult(manifest.patch, entries, validationError("ROLLBACK_BLOCKED_TARGET_CHANGED", `${blocked.filePath} changed after patch.`), "ROLLBACK_BLOCKED_TARGET_CHANGED", journalDir);
  }

  for (const entry of entries.slice().reverse()) {
    const target = path.join(root, entry.filePath);
    const current = existsSync(target) ? readFileSync(target, "utf8") : "";
    if (sha256(current) === entry.beforeHash) {
      entry.rollbackStatus = "not-required";
      continue;
    }
    const backup = readFileSync(path.join(root, entry.backupPath), "utf8");
    writeFileSync(target, backup, "utf8");
    if (sha256(readFileSync(target, "utf8")) !== entry.beforeHash) {
      entry.rollbackStatus = "blocked";
      entry.status = "rollback-blocked";
      writeManifest(journalDir, manifest.patch, entries, "rollback-blocked");
      return failedResult(manifest.patch, entries, validationError("ROLLBACK_FAILED", `${entry.filePath} rollback hash verification failed.`), "ROLLBACK_FAILED", journalDir);
    }
    entry.rollbackStatus = "applied";
    entry.status = "rolled-back";
  }
  writeFileSync(path.join(journalDir, "rollback-report.json"), `${JSON.stringify({ operationId: input.operationId, completedAt: new Date().toISOString(), entries }, null, 2)}\n`, "utf8");
  writeManifest(journalDir, manifest.patch, entries, "rolled-back");
  return { ok: true, changedFiles: entries.map((entry) => entry.filePath), journals: entries, validation: { ok: true, codes: [], message: "Rollback applied." }, rollbackAvailable: false, operationId: input.operationId, journalDir: normalize(path.relative(root, journalDir)) };
}

export function recoverProductionPatch(input: { operationId: string; root?: string }) {
  return rollbackProductionConfig(input);
}

export function findUnfinishedProductionPatches(root = projectRoot) {
  const dir = path.join(root, productionPatchesRelativeDir);
  if (!existsSync(dir)) return [] as Array<{ operationId: string; status: string }>;
  return readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => {
      const manifestPath = path.join(dir, entry.name, "manifest.json");
      if (!existsSync(manifestPath)) return undefined;
      const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as { status: string };
      return unfinishedStatuses.has(manifest.status) ? { operationId: entry.name, status: manifest.status } : undefined;
    })
    .filter(Boolean) as Array<{ operationId: string; status: string }>;
}

function patchWranglerJsonc(content: string, patch: ProductionResourcePatch) {
  const parsed = parseJsonc<Record<string, unknown>>(content, "CONFIG_PARSE_FAILED", []);
  if (!parsed) throw new Error("CONFIG_PARSE_FAILED");
  const d1 = arrayRecord(parsed.d1_databases, "CONFIG_SCHEMA_MISMATCH", [], "wrangler.d1_databases");
  const r2 = arrayRecord(parsed.r2_buckets, "CONFIG_SCHEMA_MISMATCH", [], "wrangler.r2_buckets");
  if (!d1 || !r2 || d1.binding !== "DB" || r2.binding !== "MEDIA_BUCKET") throw new Error("BINDING_MISMATCH");
  let next = replaceTopLevelString(content, "name", patch.workerName);
  next = replaceStringAfterBinding(next, "d1_databases", "DB", "database_name", patch.d1DatabaseName);
  next = replaceStringAfterBinding(next, "d1_databases", "DB", "database_id", patch.d1DatabaseId);
  next = replaceStringAfterBinding(next, "r2_buckets", "MEDIA_BUCKET", "bucket_name", patch.r2BucketName);
  next = replaceNestedString(next, "vars", "NEXT_PUBLIC_SITE_URL", patch.siteUrl);
  if (patch.r2PublicBaseUrl) next = replaceNestedString(next, "vars", "R2_PUBLIC_BASE_URL", patch.r2PublicBaseUrl);
  return next;
}

function patchStarterJson(content: string, patch: ProductionResourcePatch) {
  const parsed = parseJson<Record<string, unknown>>(content, "CONFIG_PARSE_FAILED", []);
  if (!parsed) throw new Error("CONFIG_PARSE_FAILED");
  for (const key of ["cloudflareWorkerName", "d1DatabaseName", "d1DatabaseId", "r2BucketName"]) {
    if (!(key in parsed)) throw new Error("CONFIG_SCHEMA_MISMATCH");
  }
  const urlKey = "productionUrl" in parsed ? "productionUrl" : "siteUrl" in parsed ? "siteUrl" : "";
  if (!urlKey) throw new Error("CONFIG_SCHEMA_MISMATCH");
  let next = replaceTopLevelString(content, "cloudflareWorkerName", patch.workerName);
  next = replaceTopLevelString(next, "d1DatabaseName", patch.d1DatabaseName);
  next = replaceTopLevelString(next, "d1DatabaseId", patch.d1DatabaseId);
  next = replaceTopLevelString(next, "r2BucketName", patch.r2BucketName);
  next = replaceTopLevelString(next, urlKey, patch.siteUrl);
  return next;
}

function replaceTopLevelString(content: string, key: string, value: string) {
  const pattern = new RegExp(`("${escapeRegExp(key)}"\\s*:\\s*)"[^"]*"`);
  if (!pattern.test(content)) throw new Error("CONFIG_SCHEMA_MISMATCH");
  return content.replace(pattern, `$1${JSON.stringify(value)}`);
}

function replaceNestedString(content: string, parent: string, key: string, value: string) {
  const parentMatch = new RegExp(`"${escapeRegExp(parent)}"\\s*:\\s*\\{`).exec(content);
  if (!parentMatch?.index) throw new Error("CONFIG_SCHEMA_MISMATCH");
  const start = parentMatch.index;
  const end = findMatchingBrace(content, content.indexOf("{", start));
  const segment = content.slice(start, end + 1);
  const replaced = replaceTopLevelString(segment, key, value);
  return `${content.slice(0, start)}${replaced}${content.slice(end + 1)}`;
}

function replaceStringAfterBinding(content: string, arrayKey: string, binding: string, key: string, value: string) {
  const arrayMatch = new RegExp(`"${escapeRegExp(arrayKey)}"\\s*:\\s*\\[`).exec(content);
  if (!arrayMatch?.index) throw new Error("CONFIG_SCHEMA_MISMATCH");
  const arrayStart = content.indexOf("[", arrayMatch.index);
  const arrayEnd = findMatchingBracket(content, arrayStart);
  const arraySegment = content.slice(arrayStart, arrayEnd + 1);
  const objectPattern = /\{[\s\S]*?\}/g;
  let match: RegExpExecArray | null;
  while ((match = objectPattern.exec(arraySegment))) {
    if (!new RegExp(`"binding"\\s*:\\s*"${escapeRegExp(binding)}"`).test(match[0])) continue;
    const replaced = replaceTopLevelString(match[0], key, value);
    return `${content.slice(0, arrayStart + match.index)}${replaced}${content.slice(arrayStart + match.index + match[0].length)}`;
  }
  throw new Error("BINDING_MISMATCH");
}

function atomicReplace(targetPath: string, content: string, tempRelativePath: string, root: string) {
  const tempPath = path.join(root, tempRelativePath);
  writeFileSync(tempPath, content, "utf8");
  try {
    const fd = openSync(tempPath, "r");
    closeSync(fd);
  } catch {
    // Best-effort flush compatibility on Windows; bounded rename retry below remains the safety net.
  }
  boundedRename(tempPath, targetPath);
}

function boundedRename(tempPath: string, targetPath: string) {
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      if (existsSync(targetPath)) rmSync(targetPath, { force: true });
      renameSync(tempPath, targetPath);
      return;
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error("PATCH_WRITE_FAILED");
}

function makeEntry(input: { patch: ProductionResourcePatch; filePath: string; before: string; after: string; patchFields: string[]; startedAt: string; journalDir: string; root: string }): PatchJournalEntry {
  const backupPath = path.join(input.journalDir, `${path.basename(input.filePath)}.bak`);
  writeFileSync(backupPath, input.before, "utf8");
  return {
    operationId: input.patch.operationId,
    executionPlanHash: input.patch.executionPlanHash,
    accountId: input.patch.accountId,
    adapter: input.patch.adapter,
    filePath: input.filePath,
    beforeHash: sha256(input.before),
    afterHash: sha256(input.after),
    backupPath: normalize(path.relative(input.root, backupPath)),
    tempPath: normalize(path.join(path.dirname(input.filePath), `${path.basename(input.filePath)}.tmp-${input.patch.operationId}`)),
    patchFields: input.patchFields,
    startedAt: input.startedAt,
    status: "started",
    rollbackStatus: "available",
  };
}

function writeManifest(journalDir: string, patch: ProductionResourcePatch, entries: PatchJournalEntry[], status: string) {
  mkdirSync(journalDir, { recursive: true });
  writeFileSync(path.join(journalDir, "manifest.json"), `${JSON.stringify({ operationId: patch.operationId, executionPlanHash: patch.executionPlanHash, accountId: patch.accountId, adapter: patch.adapter, status, patch: redactPatch(patch), entries }, null, 2)}\n`, "utf8");
}

function validatePatchInput(patch: ProductionResourcePatch) {
  const errors: string[] = [];
  if (!patch.operationId) errors.push("CONFIG_SCHEMA_MISMATCH");
  if (!validUuid(patch.d1DatabaseId) || patch.d1DatabaseId === placeholderUuid) errors.push("D1_ID_INVALID");
  if (!patch.workerName || !patch.d1DatabaseName || !patch.r2BucketName) errors.push("RESOURCE_NAME_MISMATCH");
  if (!patch.siteUrl.startsWith("https://")) errors.push("SITE_URL_MISMATCH");
  return errors.length ? validationError(errors[0]!, "Patch input validation failed.", errors) : { ok: true, codes: [], message: "Patch input valid." };
}

function parseJsonc<T>(content: string, code: string, errors: string[]): T | undefined {
  try {
    return JSON.parse(stripJsonComments(content)) as T;
  } catch {
    errors.push(code);
    return undefined;
  }
}

function parseJson<T>(content: string, code: string, errors: string[]): T | undefined {
  try {
    return JSON.parse(content) as T;
  } catch {
    errors.push(code);
    return undefined;
  }
}

function arrayRecord(value: unknown, code: string, errors: string[], label: string) {
  if (!Array.isArray(value) || value.length !== 1 || !isRecord(value[0])) {
    errors.push(code);
    return undefined;
  }
  return value[0] as Record<string, unknown>;
}

function recordValue(value: unknown, code: string, errors: string[], label: string) {
  if (!isRecord(value)) {
    errors.push(code);
    return undefined;
  }
  return value;
}

function validationError(code: string, message: string, codes = [code]): ConfigValidationResult {
  return { ok: false, codes: [...new Set(codes)], message: sanitizeOutput(message) };
}

function failedResult(patch: ProductionResourcePatch, journals: PatchJournalEntry[], validation: ConfigValidationResult, errorCode = "PATCH_WRITE_FAILED", journalDir = ""): ConfigPatchResult {
  const relativeJournalDir = journalDir.includes(productionPatchesRelativeDir) ? normalize(journalDir.slice(journalDir.indexOf(productionPatchesRelativeDir))) : "";
  return { ok: false, changedFiles: [], journals, validation, rollbackAvailable: journals.some((entry) => entry.rollbackStatus === "available"), errorCode, message: validation.message, operationId: patch.operationId, journalDir: relativeJournalDir };
}

function emptyPatch(operationId: string): ProductionResourcePatch {
  return { operationId, executionPlanHash: "", accountId: "", adapter: "", workerName: "", d1DatabaseName: "", d1DatabaseId: "", r2BucketName: "", siteUrl: "" };
}

function redactPatch(patch: ProductionResourcePatch) {
  return { ...patch };
}

function validUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function findMatchingBrace(content: string, start: number) {
  return findMatching(content, start, "{", "}");
}

function findMatchingBracket(content: string, start: number) {
  return findMatching(content, start, "[", "]");
}

function findMatching(content: string, start: number, open: string, close: string) {
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let index = start; index < content.length; index += 1) {
    const char = content[index];
    if (char === "\\" && inString) {
      escaped = !escaped;
      continue;
    }
    if (char === "\"" && !escaped) inString = !inString;
    if (!inString && char === open) depth += 1;
    if (!inString && char === close) depth -= 1;
    if (depth === 0) return index;
    if (char !== "\\") escaped = false;
  }
  throw new Error("CONFIG_SCHEMA_MISMATCH");
}

function normalize(input: string) {
  return input.replace(/\\/g, "/");
}
