import assert from "node:assert/strict";
import crypto from "node:crypto";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";

import { createControlledAdapter } from "../tools/starter/cloudflare-adapter";
import {
  assertNoExplicitTransactionSql,
  createOperationPlan,
  decideOperation,
  determineOwnership,
  generateSessionSecret,
  parseRemoteExecutionArgs,
  requireRuntimeAdminPassword,
  r2ProbeKey,
} from "../tools/starter/cloudflare-execution";
import { runControlledCloudflareWorkflow } from "../tools/starter/cloudflare-workflows";
import { readOperationRecords } from "../tools/starter/production-audit";
import { acquireProductionLock, productionLockRelativePath, releaseProductionLock } from "../tools/starter/production-lock";
import { rollbackPatchJournal, writePatchJournal } from "../tools/starter/production-patches";
import type { BootstrapConfigInput } from "../tools/starter/production-bootstrap";

async function main() {
  testExplicitAdapterDefault();
  testRemoteDoesNotEnableWrangler();
  testExecuteWithoutAllowFlagsBlocked();
  testOwnershipStates();
  testRuntimeAdminPasswordOnly();
  testSessionSecretRandom();
  await testSecretStdinAndRedaction();
  testD1Safety();
  testR2ProbeRules();
  testExecutionLock();
  testPatchJournalRollback();
  await testRemoteReadOnlyModes();
  await testOperationLogShape();
  console.log("PASS cloudflare execution tests");
}

function testExplicitAdapterDefault() {
  assert.equal(parseRemoteExecutionArgs([]).adapterMode, "offline");
  assert.equal(parseRemoteExecutionArgs(["--adapter=mock"]).adapterMode, "mock");
  assert.equal(parseRemoteExecutionArgs(["--adapter=wrangler"]).adapterMode, "wrangler");
  assert.throws(() => parseRemoteExecutionArgs(["--adapter=real"]), /Invalid Cloudflare adapter/);
}

function testRemoteDoesNotEnableWrangler() {
  assert.equal(parseRemoteExecutionArgs(["--remote"]).adapterMode, "offline");
  assert.equal(parseRemoteExecutionArgs(["--remote", "--yes", "--account-id=abc"]).adapterMode, "offline");
}

function testExecuteWithoutAllowFlagsBlocked() {
  const options = parseRemoteExecutionArgs(["--execute", "--account-id=acct"]);
  const plan = createOperationPlan({
    stepId: "worker",
    accountId: "acct",
    resourceType: "worker",
    resourceName: "example-worker",
    action: "create-worker",
    riskLevel: 3,
    ownership: "missing",
    requiredAllowFlags: ["allowCreateWorker", "allowDeploy"],
    previousState: "missing",
    resultingState: "created",
  });
  const decision = decideOperation(plan, options);
  assert.equal(decision.status, "blocked");
  assert.deepEqual(decision.missingAllowFlags, ["allowCreateWorker", "allowDeploy"]);
}

function testOwnershipStates() {
  assert.equal(determineOwnership({ desiredName: "a", matches: [] }), "missing");
  assert.equal(determineOwnership({ desiredName: "a", matches: [{ name: "a" }, { name: "a" }] }), "ambiguous");
  assert.equal(determineOwnership({ desiredName: "a", desiredId: "1", matches: [{ name: "a", id: "2" }] }), "foreign");
  assert.equal(determineOwnership({ desiredName: "a", explicitReuse: "a", matches: [{ name: "a" }] }), "explicitly-reused");
  assert.equal(determineOwnership({ desiredName: "a", matches: [{ name: "a" }] }), "owned");
}

function testRuntimeAdminPasswordOnly() {
  const key = `test-secret-${crypto.randomUUID()}`;
  assert.throws(() => requireRuntimeAdminPassword({}), /CONTENTFORGE_ADMIN_PASSWORD/);
  assert.equal(requireRuntimeAdminPassword({ CONTENTFORGE_ADMIN_PASSWORD: key }), key);
}

function testSessionSecretRandom() {
  const first = generateSessionSecret();
  const second = generateSessionSecret();
  assert.notEqual(first, second);
  assert(first.length >= 40);
}

async function testSecretStdinAndRedaction() {
  const secretValue = `dynamic-${crypto.randomUUID()}`;
  const adapter = createControlledAdapter("mock");
  const result = await adapter.putWorkerSecret("acct", "worker", "ADMIN_PASSWORD", secretValue);
  assert.equal(result.ok, true);
  assert(adapter.callLog.includes("putWorkerSecret:ADMIN_PASSWORD:stdin"));
  assert(!JSON.stringify(result).includes(secretValue));
  assert(!adapter.callLog.join("\n").includes(secretValue));
}

function testD1Safety() {
  assert.doesNotThrow(() => assertNoExplicitTransactionSql("CREATE TABLE IF NOT EXISTS x (id TEXT)"));
  assert.throws(() => assertNoExplicitTransactionSql("BEGIN; CREATE TABLE x (id TEXT); COMMIT;"), /transaction SQL/);
}

function testR2ProbeRules() {
  const key = r2ProbeKey("op-123");
  assert.equal(key, ".contentforge-probe/op-123.txt");
}

function testExecutionLock() {
  const operationId = `lock-${crypto.randomUUID()}`;
  const lockPath = path.join(process.cwd(), productionLockRelativePath);
  if (existsSync(lockPath)) rmSync(lockPath, { force: true });
  const lock = acquireProductionLock({ operationId, mode: "test", riskLevel: 3, targetSummary: "test" });
  assert.equal(lock.operationId, operationId);
  assert.throws(() => acquireProductionLock({ operationId: "other", mode: "test", riskLevel: 3, targetSummary: "test" }), /lock is active/);
  releaseProductionLock(operationId);
  assert(!existsSync(lockPath));
}

function testPatchJournalRollback() {
  const operationId = `patch-${crypto.randomUUID()}`;
  const target = path.join(".contentforge", "test-patch-target.txt");
  const absolute = path.join(process.cwd(), target);
  mkdirSync(path.dirname(absolute), { recursive: true });
  writeFileSync(absolute, "before", "utf8");
  const journal = writePatchJournal({
    operationId,
    targetFile: target,
    patchSummary: "test reversible patch",
    write: () => "after",
  });
  assert.equal(journal.rollbackAvailable, true);
  assert.equal(readFileSync(absolute, "utf8"), "after");
  rollbackPatchJournal(operationId);
  assert.equal(readFileSync(absolute, "utf8"), "before");
}

async function testRemoteReadOnlyModes() {
  const adapter = createControlledAdapter("mock");
  const report = await runControlledCloudflareWorkflow({
    config: validConfig(),
    options: parseRemoteExecutionArgs(["--remote-check", "--adapter=mock", "--account-id=mock-account"]),
    adapter,
  });
  assert.equal(report.mode, "remote-check");
  assert(!adapter.callLog.some((call) => call.startsWith("putWorkerSecret") || call === "putR2Object" || call === "executeD1"));
}

async function testOperationLogShape() {
  const secretValue = `dynamic-${crypto.randomUUID()}`;
  process.env.CONTENTFORGE_ADMIN_PASSWORD = secretValue;
  try {
    const adapter = createControlledAdapter("mock");
    const plan = await runControlledCloudflareWorkflow({
      config: validConfig(),
      options: parseRemoteExecutionArgs(["--remote-plan", "--adapter=mock", "--account-id=mock-account"]),
      adapter,
    });
    const executeAdapter = createControlledAdapter("mock", { failNext: "createD1Database" });
    const report = await runControlledCloudflareWorkflow({
      config: validConfig(),
      options: parseRemoteExecutionArgs([
        "--execute",
        "--adapter=mock",
        "--account-id=mock-account",
        `--approved-plan-hash=${plan.planHash}`,
        "--allow-create-worker",
        "--allow-deploy",
        "--allow-create-d1",
        "--allow-create-r2",
        "--allow-config-patch",
        "--allow-set-secrets",
        "--allow-d1-write",
        "--allow-bootstrap-seed",
        "--allow-r2-probe",
      ]),
      adapter: executeAdapter,
    });
    assert.equal(report.summary, "failed");
    const records = readOperationRecords();
    const last = records[records.length - 1];
    assert(last);
    assert("riskLevel" in last);
    assert("stepId" in last);
    assert("operationKey" in last);
    assert("allowFlagsUsed" in last);
    assert("targetSummary" in last);
    assert("planHash" in last);
    assert("previousState" in last);
    assert("resultingState" in last);
    assert.equal(last.result, "failed");
    assert(!JSON.stringify(records).includes(secretValue));
  } finally {
    delete process.env.CONTENTFORGE_ADMIN_PASSWORD;
  }
}

function validConfig(): BootstrapConfigInput {
  return {
    siteName: "Cloudflare Execution Test",
    siteSlug: "cloudflare-execution-test",
    siteUrl: "https://cloudflare-execution.example",
    canonicalHost: "cloudflare-execution.example",
    workerName: "contentforge-it-cloudflare-execution-test",
    d1DatabaseName: "contentforge-it-cloudflare-execution-test-db",
    d1DatabaseId: "11111111-1111-4111-8111-111111111111",
    r2BucketName: "contentforge-it-cloudflare-execution-test-media",
    r2PublicBaseUrl: "https://cloudflare-execution.example/media",
    customDomain: "cloudflare-execution.example",
    wwwRedirect: true,
    cloudflareAccountId: "mock-account",
    productionFallback: false,
    deploymentEnvironment: "production",
  };
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
