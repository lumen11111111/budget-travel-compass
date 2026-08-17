import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";

import { createControlledAdapter, type ControlledCloudflareAdapter, type D1Resource, type R2Resource } from "../tools/starter/cloudflare-adapter";
import { parseRemoteExecutionArgs } from "../tools/starter/cloudflare-execution";
import { readOperationRecords } from "../tools/starter/production-audit";
import { rollbackProductionConfig } from "../tools/starter/production-config-patch";
import { runControlledCloudflareWorkflow } from "../tools/starter/cloudflare-workflows";
import type { BootstrapConfigInput } from "../tools/starter/production-bootstrap";

const writeCalls = [
  "createD1Database",
  "createR2Bucket",
  "deployWorker",
  "executeD1",
  "putR2Object",
  "getR2Object",
  "deleteR2Object",
];

async function main() {
  const seedBackup = ensureSeedSource();
  const secretBackup = backupSecrets();
  try {
    setMockSecrets();
    await testOnlyCreateFlagsBlockedBeforeWrites();
    await testMissingConfigPatchBlockedBeforeWrites();
    await testMissingDeployBlockedBeforeWrites();
    await testMissingSecretWriteBlockedBeforeWrites();
    await testMissingD1WriteBlockedBeforeWrites();
    await testMissingBootstrapSeedBlockedBeforeWrites();
    await testMissingR2ProbeBlockedBeforeWrites();
    await testYesDoesNotAuthorize();
    await testAllFlagsEnterWrites();
    await testResumeSkipsVerifiedCreateFlags();
    console.log("PASS production full write preflight tests");
  } finally {
    restoreSeedSource(seedBackup);
    restoreSecrets(secretBackup);
  }
}

async function testOnlyCreateFlagsBlockedBeforeWrites() {
  const report = await executeWithFlags(["--allow-create-d1", "--allow-create-r2"]);
  assertBlockedWithoutWrites(report, ["allowConfigPatch", "allowDeploy", "allowSetSecrets", "allowD1Write", "allowBootstrapSeed", "allowR2Probe"]);
}

async function testMissingConfigPatchBlockedBeforeWrites() {
  const report = await executeWithAllExcept("allowConfigPatch");
  assertBlockedWithoutWrites(report, ["allowConfigPatch"]);
}

async function testMissingDeployBlockedBeforeWrites() {
  const report = await executeWithAllExcept("allowDeploy");
  assertBlockedWithoutWrites(report, ["allowDeploy"]);
}

async function testMissingSecretWriteBlockedBeforeWrites() {
  const report = await executeWithAllExcept("allowSetSecrets");
  assertBlockedWithoutWrites(report, ["allowSetSecrets"]);
}

async function testMissingD1WriteBlockedBeforeWrites() {
  const report = await executeWithAllExcept("allowD1Write");
  assertBlockedWithoutWrites(report, ["allowD1Write"]);
}

async function testMissingBootstrapSeedBlockedBeforeWrites() {
  const report = await executeWithAllExcept("allowBootstrapSeed");
  assertBlockedWithoutWrites(report, ["allowBootstrapSeed"]);
}

async function testMissingR2ProbeBlockedBeforeWrites() {
  const report = await executeWithAllExcept("allowR2Probe");
  assertBlockedWithoutWrites(report, ["allowR2Probe"]);
}

async function testYesDoesNotAuthorize() {
  const report = await executeWithFlags(["--allow-create-d1", "--allow-create-r2", "--yes"]);
  assertBlockedWithoutWrites(report, ["allowConfigPatch", "allowDeploy", "allowSetSecrets", "allowD1Write", "allowBootstrapSeed", "allowR2Probe"]);
}

async function testAllFlagsEnterWrites() {
  const before = configSnapshot();
  const adapter = createControlledAdapter("mock");
  const report = await executeWithFlags(allAllowArgs(), adapter);
  try {
    assert.equal(report.report.summary, "passed");
    assert(adapter.callLog.includes("createD1Database"));
    assert(adapter.callLog.includes("createR2Bucket"));
    assert(adapter.callLog.includes("deployWorker"));
  } finally {
    rollbackLatestPatchIfNeeded();
  }
  assert.deepEqual(configSnapshot(), before);
}

async function testResumeSkipsVerifiedCreateFlags() {
  const d1Resource: D1Resource = { name: validConfig().d1DatabaseName, id: "11111111-1111-4111-8111-111111111111", accountId: "mock-account" };
  const r2Resource: R2Resource = { name: validConfig().r2BucketName, accountId: "mock-account" };
  const fixture = { d1: [d1Resource], r2: [r2Resource] };
  const planAdapter = createControlledAdapter("mock", fixture);
  const plan = await runControlledCloudflareWorkflow({
    config: validConfig(),
    options: parseRemoteExecutionArgs(["--remote-plan", "--adapter=mock", "--account-id=mock-account"]),
    adapter: planAdapter,
  });
  writeResumeReport(plan.planHash);
  const executeAdapter = createControlledAdapter("mock", fixture);
  const report = await runControlledCloudflareWorkflow({
    config: validConfig(),
    options: parseRemoteExecutionArgs([
      "--execute",
      "--resume",
      "--adapter=mock",
      "--account-id=mock-account",
      `--approved-plan-hash=${plan.planHash}`,
      "--allow-config-patch",
      "--allow-deploy",
      "--allow-set-secrets",
      "--allow-d1-write",
      "--allow-bootstrap-seed",
      "--allow-r2-probe",
    ]),
    adapter: executeAdapter,
  });
  try {
    assert.equal(report.summary, "passed");
    assert(!executeAdapter.callLog.includes("createD1Database"));
    assert(!executeAdapter.callLog.includes("createR2Bucket"));
  } finally {
    rollbackLatestPatchIfNeeded();
  }
}

async function executeWithAllExcept(flag: string) {
  return executeWithFlags(allAllowArgs().filter((arg) => !argForFlag(flag).includes(arg)));
}

async function executeWithFlags(flags: string[], adapter: ControlledCloudflareAdapter = createControlledAdapter("mock")) {
  const beforeConfig = configSnapshot();
  const beforeAuditCount = readOperationRecords().length;
  const plan = await runControlledCloudflareWorkflow({
    config: validConfig(),
    options: parseRemoteExecutionArgs(["--remote-plan", "--adapter=mock", "--account-id=mock-account"]),
    adapter: createControlledAdapter("mock"),
  });
  const report = await runControlledCloudflareWorkflow({
    config: validConfig(),
    options: parseRemoteExecutionArgs(["--execute", "--adapter=mock", "--account-id=mock-account", `--approved-plan-hash=${plan.planHash}`, ...flags]),
    adapter,
  });
  return { report, adapter, beforeConfig, beforeAuditCount };
}

function assertBlockedWithoutWrites(input: Awaited<ReturnType<typeof executeWithFlags>>, expectedMissing: string[]) {
  assert.equal(input.report.summary, "blocked");
  for (const call of writeCalls) {
    assert(!input.adapter.callLog.some((entry) => entry.startsWith(call)), `${call} should not be called before full write preflight passes`);
  }
  assert.deepEqual(configSnapshot(), input.beforeConfig);
  assert.equal(readOperationRecords().length, input.beforeAuditCount);
  const payload = JSON.parse(readFileSync(path.join(process.cwd(), ".contentforge", "production-execution-report.json"), "utf8")) as {
    actualResults?: unknown[];
    missingWriteAllowFlags?: string[];
    writeAuthorizationDecisions?: Array<{ planned?: boolean; authorized?: boolean; stepId?: string }>;
  };
  assert.deepEqual(payload.actualResults ?? [], []);
  assert(payload.writeAuthorizationDecisions?.some((decision) => decision.planned && !decision.authorized));
  for (const missing of expectedMissing) {
    assert(payload.missingWriteAllowFlags?.includes(missing), `missing flag ${missing} should be reported`);
  }
}

function allAllowArgs() {
  return [
    "--allow-create-d1",
    "--allow-create-r2",
    "--allow-config-patch",
    "--allow-deploy",
    "--allow-set-secrets",
    "--allow-d1-write",
    "--allow-bootstrap-seed",
    "--allow-r2-probe",
  ];
}

function argForFlag(flag: string) {
  const map: Record<string, string[]> = {
    allowCreateD1: ["--allow-create-d1"],
    allowCreateR2: ["--allow-create-r2"],
    allowConfigPatch: ["--allow-config-patch"],
    allowDeploy: ["--allow-deploy"],
    allowSetSecrets: ["--allow-set-secrets"],
    allowD1Write: ["--allow-d1-write"],
    allowBootstrapSeed: ["--allow-bootstrap-seed"],
    allowR2Probe: ["--allow-r2-probe"],
  };
  return map[flag] ?? [];
}

function validConfig(): BootstrapConfigInput {
  return {
    siteName: "Production Full Write Preflight",
    siteSlug: "contentforge-it-preflight",
    siteUrl: "https://contentforge-it-preflight-worker.workers.dev",
    canonicalHost: "contentforge-it-preflight-worker.workers.dev",
    workerName: "contentforge-it-preflight-worker",
    d1DatabaseName: "contentforge-it-preflight-d1",
    d1DatabaseId: "00000000-0000-0000-0000-000000000000",
    r2BucketName: "contentforge-it-preflight-media",
    r2PublicBaseUrl: "https://contentforge-it-preflight-worker.workers.dev/media",
    customDomain: "",
    wwwRedirect: false,
    cloudflareAccountId: "mock-account",
    productionFallback: false,
    deploymentEnvironment: "production",
  };
}

function writeResumeReport(planHash: string) {
  const dir = path.join(process.cwd(), ".contentforge");
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    path.join(dir, "production-execution-report.json"),
    `${JSON.stringify({ planHash, actualResults: [{ stepId: "d1", outcome: "success" }, { stepId: "r2", outcome: "success" }] }, null, 2)}\n`,
    "utf8",
  );
}

function rollbackLatestPatchIfNeeded() {
  const reportPath = path.join(process.cwd(), ".contentforge", "production-execution-report.json");
  if (!existsSync(reportPath)) return;
  const payload = JSON.parse(readFileSync(reportPath, "utf8")) as { patchOperationId?: string };
  if (payload.patchOperationId) rollbackProductionConfig({ operationId: payload.patchOperationId });
}

function configSnapshot() {
  return {
    wrangler: readFileSync(path.join(process.cwd(), "wrangler.jsonc"), "utf8"),
    starter: readFileSync(path.join(process.cwd(), "starter.site.json"), "utf8"),
  };
}

function ensureSeedSource() {
  const seedPath = path.join(process.cwd(), "data", "d1-seed.sql");
  const existed = existsSync(seedPath);
  const before = existed ? readFileSync(seedPath, "utf8") : "";
  mkdirSync(path.dirname(seedPath), { recursive: true });
  writeFileSync(seedPath, "INSERT INTO site_settings (key, value_json, updated_at) VALUES ('preflight', '{}', '2026-08-06T00:00:00.000Z');\n", "utf8");
  return { existed, before };
}

function restoreSeedSource(backup: { existed: boolean; before: string }) {
  const seedPath = path.join(process.cwd(), "data", "d1-seed.sql");
  if (backup.existed) writeFileSync(seedPath, backup.before, "utf8");
  else if (existsSync(seedPath)) rmSync(seedPath, { force: true });
}

function backupSecrets() {
  return {
    admin: process.env.CONTENTFORGE_ADMIN_PASSWORD,
    session: process.env.CONTENTFORGE_SESSION_SECRET,
  };
}

function setMockSecrets() {
  process.env.CONTENTFORGE_ADMIN_PASSWORD = "preflight-admin-secret-12345";
  process.env.CONTENTFORGE_SESSION_SECRET = "preflight-session-secret-12345678901234567890";
}

function restoreSecrets(backup: { admin?: string; session?: string }) {
  if (backup.admin === undefined) delete process.env.CONTENTFORGE_ADMIN_PASSWORD;
  else process.env.CONTENTFORGE_ADMIN_PASSWORD = backup.admin;
  if (backup.session === undefined) delete process.env.CONTENTFORGE_SESSION_SECRET;
  else process.env.CONTENTFORGE_SESSION_SECRET = backup.session;
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
