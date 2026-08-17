import assert from "node:assert/strict";
import { existsSync, rmSync } from "node:fs";
import path from "node:path";

import { createControlledAdapter, type ControlledCloudflareAdapter } from "../tools/starter/cloudflare-adapter";
import { parseRemoteExecutionArgs } from "../tools/starter/cloudflare-execution";
import { runControlledCloudflareWorkflow } from "../tools/starter/cloudflare-workflows";
import { readOperationRecords } from "../tools/starter/production-audit";
import { productionLockRelativePath } from "../tools/starter/production-lock";
import type { BootstrapConfigInput } from "../tools/starter/production-bootstrap";

async function main() {
  await testAdapterFailureDoesNotRecordSuccess();
  await testD1FailureStopsR2();
  await testR2FailureStopsDependentSteps();
  await testExceptionReleasesLock();
  testAllowFlagAliases();
  await testRealWriteGateBlocksWranglerCreate();
  console.log("PASS production write result handling tests");
}

async function testAdapterFailureDoesNotRecordSuccess() {
  removeLock();
  const before = readOperationRecords().length;
  const planAdapter = createControlledAdapter("mock");
  const plan = await runControlledCloudflareWorkflow({ config: validConfig(), options: parseRemoteExecutionArgs(["--remote-plan", "--adapter=mock", "--account-id=mock-account"]), adapter: planAdapter });
  const executeAdapter = createControlledAdapter("mock", { failNext: "createD1Database" });
  const report = await runControlledCloudflareWorkflow({
    config: validConfig(),
    options: parseRemoteExecutionArgs(executeArgs(plan.planHash)),
    adapter: executeAdapter,
  });
  assert.equal(report.summary, "failed");
  const records = readOperationRecords().slice(before);
  assert(records.some((record) => record.stepId === "d1" && record.result === "failed"));
  assert(!records.some((record) => record.stepId === "d1" && record.result === "success"));
}

async function testD1FailureStopsR2() {
  removeLock();
  const plan = await runControlledCloudflareWorkflow({ config: validConfig(), options: parseRemoteExecutionArgs(["--remote-plan", "--adapter=mock", "--account-id=mock-account"]), adapter: createControlledAdapter("mock") });
  const adapter = createControlledAdapter("mock", { failNext: "createD1Database" });
  await runControlledCloudflareWorkflow({
    config: validConfig(),
    options: parseRemoteExecutionArgs(executeArgs(plan.planHash)),
    adapter,
  });
  assert(!adapter.callLog.includes("createR2Bucket"));
}

async function testR2FailureStopsDependentSteps() {
  removeLock();
  const plan = await runControlledCloudflareWorkflow({ config: validConfig(), options: parseRemoteExecutionArgs(["--remote-plan", "--adapter=mock", "--account-id=mock-account"]), adapter: createControlledAdapter("mock") });
  const adapter = createControlledAdapter("mock", { failNext: "createR2Bucket" });
  const report = await runControlledCloudflareWorkflow({
    config: validConfig(),
    options: parseRemoteExecutionArgs(executeArgs(plan.planHash)),
    adapter,
  });
  assert.equal(report.summary, "failed");
  assert(!adapter.callLog.includes("deployWorker"));
  assert(!adapter.callLog.includes("putR2Object"));
}

async function testExceptionReleasesLock() {
  removeLock();
  const plan = await runControlledCloudflareWorkflow({ config: validConfig(), options: parseRemoteExecutionArgs(["--remote-plan", "--adapter=mock", "--account-id=mock-account"]), adapter: createControlledAdapter("mock") });
  const adapter = throwingAdapter();
  const report = await runControlledCloudflareWorkflow({
    config: validConfig(),
    options: parseRemoteExecutionArgs(executeArgs(plan.planHash)),
    adapter,
  });
  assert.equal(report.summary, "failed");
  assert(!existsSync(path.join(process.cwd(), productionLockRelativePath)));
}

function testAllowFlagAliases() {
  const parsed = parseRemoteExecutionArgs(["--yes", "--allow-worker-create", "--allow-d1-create", "--allow-r2-create", "--allow-d1-execute"]);
  assert.equal(parsed.allowFlags.allowCreateWorker, true);
  assert.equal(parsed.allowFlags.allowCreateD1, true);
  assert.equal(parsed.allowFlags.allowCreateR2, true);
  assert.equal(parsed.allowFlags.allowD1Write, true);
  assert.equal(parseRemoteExecutionArgs(["--yes"]).allowFlags.allowCreateD1, false);
}

async function testRealWriteGateBlocksWranglerCreate() {
  delete process.env.CONTENTFORGE_ENABLE_REAL_CLOUDFLARE_WRITES;
  const adapter = createControlledAdapter("wrangler");
  const d1 = await adapter.createD1Database("acct", "not-safe-production-name");
  assert.equal(d1.ok, false);
  assert.equal(d1.errorCode, "REAL_CLOUDFLARE_WRITE_GATE_BLOCKED");
  const r2 = await adapter.createR2Bucket("acct", "not-safe-production-name");
  assert.equal(r2.ok, false);
  assert.equal(r2.errorCode, "REAL_CLOUDFLARE_WRITE_GATE_BLOCKED");
}

function throwingAdapter(): ControlledCloudflareAdapter {
  const adapter = createControlledAdapter("mock");
  return new Proxy(adapter, {
    get(target, property, receiver) {
      if (property !== "createD1Database") return Reflect.get(target, property, receiver);
      return async () => {
        target.callLog.push("createD1Database");
        throw new Error("fixture exception");
      };
    },
  });
}

function validConfig(): BootstrapConfigInput {
  return {
    siteName: "Phase Two",
    siteSlug: "phase-two",
    siteUrl: "https://phase-two.example",
    canonicalHost: "phase-two.example",
    workerName: "contentforge-it-phase-two-worker",
    d1DatabaseName: "contentforge-it-phase-two-db",
    d1DatabaseId: "",
    r2BucketName: "contentforge-it-phase-two-media",
    r2PublicBaseUrl: "https://phase-two.example/media",
    customDomain: "phase-two.example",
    wwwRedirect: true,
    cloudflareAccountId: "mock-account",
    productionFallback: false,
    deploymentEnvironment: "production",
  };
}

function executeArgs(planHash: string) {
  return [
    "--execute",
    "--adapter=mock",
    "--account-id=mock-account",
    `--approved-plan-hash=${planHash}`,
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

function removeLock() {
  const lockPath = path.join(process.cwd(), productionLockRelativePath);
  if (existsSync(lockPath)) rmSync(lockPath, { force: true });
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
