import assert from "node:assert/strict";
import crypto from "node:crypto";
import { existsSync, readFileSync, rmSync } from "node:fs";
import path from "node:path";

import { createControlledAdapter } from "../tools/starter/cloudflare-adapter";
import { generateIntegrationPrefix, integrationResourceNames, validateIntegrationPrefix } from "../tools/starter/cloudflare-integration-names";
import { parseIntegrationArgs, runCloudflareIntegration } from "../tools/starter/cloudflare-integration-runner";
import { parseWranglerOutput, type WranglerOutputInput } from "../tools/starter/cloudflare-wrangler-output";

async function main() {
  cleanIntegrationOutput("contentforge-it-mock");
  testNameValidation();
  await testDefaultBlocked();
  await testOfflinePlan();
  await testMissingAccountBlocked();
  await testCollisionBlocked();
  await testMissingPlanHashBlocked();
  await testStalePlanBlocked();
  await testMissingAllowFlagsBlocked();
  await testMockIntegration();
  await testOfflineIntegration();
  await testWranglerHardBlocked();
  await testCleanupOnlyGates();
  testWranglerFixtures();
  console.log("PASS cloudflare integration runner tests");
}

async function testOfflineIntegration() {
  const fullArgs = [
    "--integration",
    "--adapter=offline",
    "--account-id=offline-account",
    "--resource-prefix=contentforge-it-offline",
    "--allow-create-worker",
    "--allow-deploy",
    "--allow-create-d1",
    "--allow-create-r2",
    "--allow-set-secrets",
    "--allow-d1-write",
    "--allow-cleanup",
  ];
  const first = await runCloudflareIntegration({
    options: parseIntegrationArgs(fullArgs),
    adapter: createControlledAdapter("offline"),
    now: fixedDate(),
  });
  const report = await runCloudflareIntegration({
    options: parseIntegrationArgs([...fullArgs, `--approved-plan-hash=${first.planHash}`]),
    adapter: createControlledAdapter("offline"),
    now: fixedDate(),
  });
  assert.equal(report.manifest.finalVerdict, "mock-passed");
  assert.equal(report.manifest.realCloudflareAccess, false);
  assert.equal(report.manifest.realResourcesCreated, false);
}

async function testWranglerHardBlocked() {
  const previous = {
    isolated: process.env.CONTENTFORGE_ISOLATED_CLOUDFLARE_AUTHORIZED,
    writes: process.env.CONTENTFORGE_ENABLE_REAL_CLOUDFLARE_WRITES,
    deploy: process.env.CONTENTFORGE_ENABLE_REAL_WORKER_DEPLOY,
    secrets: process.env.CONTENTFORGE_ENABLE_REAL_SECRET_WRITES,
    d1: process.env.CONTENTFORGE_ENABLE_REAL_D1_WRITES,
    r2: process.env.CONTENTFORGE_ENABLE_REAL_R2_WRITES,
  };
  process.env.CONTENTFORGE_ISOLATED_CLOUDFLARE_AUTHORIZED = "true";
  process.env.CONTENTFORGE_ENABLE_REAL_CLOUDFLARE_WRITES = "1";
  process.env.CONTENTFORGE_ENABLE_REAL_WORKER_DEPLOY = "1";
  process.env.CONTENTFORGE_ENABLE_REAL_SECRET_WRITES = "1";
  process.env.CONTENTFORGE_ENABLE_REAL_D1_WRITES = "1";
  process.env.CONTENTFORGE_ENABLE_REAL_R2_WRITES = "1";
  try {
    const spy = createControlledAdapter("mock");
    const report = await runCloudflareIntegration({
      options: parseIntegrationArgs([
        "--integration",
        "--adapter=wrangler",
        "--account-id=real-account",
        "--resource-prefix=contentforge-it-wrangler-blocked",
        "--approved-plan-hash=anything",
        "--allow-create-worker",
        "--allow-deploy",
        "--allow-create-d1",
        "--allow-create-r2",
        "--allow-set-secrets",
        "--allow-d1-write",
        "--allow-cleanup",
      ]),
      adapter: spy,
      now: fixedDate(),
    });
    assert.equal(report.manifest.finalVerdict, "blocked");
    assert.match(report.checks[0]?.detail ?? "", /LEGACY_INTEGRATION_RUNNER_WRANGLER_DISABLED/);
    assert.deepEqual(spy.callLog, []);
  } finally {
    restoreEnv("CONTENTFORGE_ISOLATED_CLOUDFLARE_AUTHORIZED", previous.isolated);
    restoreEnv("CONTENTFORGE_ENABLE_REAL_CLOUDFLARE_WRITES", previous.writes);
    restoreEnv("CONTENTFORGE_ENABLE_REAL_WORKER_DEPLOY", previous.deploy);
    restoreEnv("CONTENTFORGE_ENABLE_REAL_SECRET_WRITES", previous.secrets);
    restoreEnv("CONTENTFORGE_ENABLE_REAL_D1_WRITES", previous.d1);
    restoreEnv("CONTENTFORGE_ENABLE_REAL_R2_WRITES", previous.r2);
  }
}

function testNameValidation() {
  const prefix = generateIntegrationPrefix(new Date("2026-08-04T00:00:00.000Z"));
  assert(prefix.startsWith("contentforge-it-20260804t000000z-"));
  assert(validateIntegrationPrefix("bad-prefix").includes("resource prefix must start with contentforge-it-"));
  assert(validateIntegrationPrefix("contentforge-it-MOCK").some((item) => item.includes("lowercase")));
  assert(validateIntegrationPrefix("contentforge-it-mock").length === 0);
}

async function testDefaultBlocked() {
  const report = await runCloudflareIntegration({ options: parseIntegrationArgs([]), now: fixedDate() });
  assert.equal(report.manifest.finalVerdict, "blocked");
  assert.equal(report.manifest.realCloudflareAccess, false);
  assert.equal(report.manifest.realResourcesCreated, false);
}

async function testOfflinePlan() {
  const report = await runCloudflareIntegration({
    options: parseIntegrationArgs(["--plan", "--resource-prefix=contentforge-it-mock"]),
    now: fixedDate(),
  });
  assert.equal(report.manifest.finalVerdict, "planned");
  assert.equal(report.manifest.baseline.baselineSource, "offline");
  assert.equal(report.manifest.baseline.remoteVerified, false);
  assert.equal(report.manifest.adapter, "offline");
  assert.equal(report.manifest.realCloudflareAccess, false);
  assert.equal(report.manifest.realResourcesCreated, false);
  assert.equal(report.manifest.cleanupPolicy, "success-cleanup");
  assert(report.planHash);
}

async function testMissingAccountBlocked() {
  const report = await runCloudflareIntegration({
    options: parseIntegrationArgs(["--integration", "--adapter=mock", "--resource-prefix=contentforge-it-mock"]),
    adapter: createControlledAdapter("mock"),
    now: fixedDate(),
  });
  assert.equal(report.manifest.finalVerdict, "blocked");
  assert.match(report.checks[0]?.detail ?? "", /account-id/);
}

async function testCollisionBlocked() {
  const names = integrationResourceNames("contentforge-it-mock");
  const report = await runCloudflareIntegration({
    options: parseIntegrationArgs(["--integration", "--adapter=mock", "--account-id=mock-account", "--resource-prefix=contentforge-it-mock"]),
    adapter: createControlledAdapter("mock", { workers: [{ name: names.workerName }] }),
    now: fixedDate(),
  });
  assert.equal(report.manifest.finalVerdict, "blocked");
  assert.match(report.checks[0]?.detail ?? "", /collision/);
}

async function testMissingPlanHashBlocked() {
  const report = await runCloudflareIntegration({
    options: parseIntegrationArgs(["--integration", "--adapter=mock", "--account-id=mock-account", "--resource-prefix=contentforge-it-mock"]),
    adapter: createControlledAdapter("mock"),
    now: fixedDate(),
  });
  assert.equal(report.manifest.finalVerdict, "blocked");
  assert.match(report.checks[0]?.detail ?? "", /approved-plan-hash/);
}

async function testStalePlanBlocked() {
  const report = await runCloudflareIntegration({
    options: parseIntegrationArgs(["--integration", "--adapter=mock", "--account-id=mock-account", "--resource-prefix=contentforge-it-mock", "--approved-plan-hash=stale"]),
    adapter: createControlledAdapter("mock"),
    now: fixedDate(),
  });
  assert.equal(report.manifest.finalVerdict, "blocked");
  assert.match(report.checks[0]?.detail ?? "", /stale/);
}

async function testMissingAllowFlagsBlocked() {
  const first = await runCloudflareIntegration({
    options: parseIntegrationArgs(["--integration", "--adapter=mock", "--account-id=mock-account", "--resource-prefix=contentforge-it-mock"]),
    adapter: createControlledAdapter("mock"),
    now: fixedDate(),
  });
  const second = await runCloudflareIntegration({
    options: parseIntegrationArgs(["--integration", "--adapter=mock", "--account-id=mock-account", "--resource-prefix=contentforge-it-mock", `--approved-plan-hash=${first.planHash}`]),
    adapter: createControlledAdapter("mock"),
    now: fixedDate(),
  });
  assert.equal(second.manifest.finalVerdict, "blocked");
  assert.match(second.checks[0]?.detail ?? "", /allowCreateWorker/);
}

async function testMockIntegration() {
  const fullArgs = [
    "--integration",
    "--adapter=mock",
    "--account-id=mock-account",
    "--resource-prefix=contentforge-it-mock",
    "--allow-create-worker",
    "--allow-deploy",
    "--allow-create-d1",
    "--allow-create-r2",
    "--allow-set-secrets",
    "--allow-d1-write",
    "--allow-cleanup",
    "--yes",
  ];
  const first = await runCloudflareIntegration({
    options: parseIntegrationArgs(fullArgs),
    adapter: createControlledAdapter("mock"),
    now: fixedDate(),
  });
  const report = await runCloudflareIntegration({
    options: parseIntegrationArgs([...fullArgs, `--approved-plan-hash=${first.planHash}`]),
    adapter: createControlledAdapter("mock"),
    now: fixedDate(),
  });
  assert.equal(report.manifest.finalVerdict, "mock-passed");
  assert.notEqual(report.manifest.finalVerdict, "integration-passed");
  assert.equal(report.manifest.realCloudflareAccess, false);
  assert.equal(report.manifest.realResourcesCreated, false);
  assert(report.resources.every((resource) => resource.stateBefore === "missing"));
  assert(report.resources.every((resource) => resource.createdByCurrentOperation));
  assert(report.resources.every((resource) => resource.verifiedAfterCreate));
  assert(report.resources.every((resource) => resource.cleanupEligible));
  assert(report.manifest.stepResults.find((step) => step.stepId === "secrets"));
  assert(report.manifest.knownLimitations.includes("Real Cloudflare integration not tested."));
  assert(report.manifest.knownLimitations.includes("Real Domain/DNS integration not tested."));
  const manifestText = readFileSync(path.join(report.outputPath, "manifest.json"), "utf8");
  const reportText = readFileSync(path.join(report.outputPath, "report.md"), "utf8");
  assert(reportText.includes("Real Cloudflare integration not tested."));
  assert(reportText.includes("Real Domain/DNS integration not tested."));
  assert(!manifestText.includes("integration-"));
  assert(!manifestText.includes("SESSION_SECRET"));
}

async function testCleanupOnlyGates() {
  const blocked = await runCloudflareIntegration({
    options: parseIntegrationArgs(["--cleanup-only=it-example", "--adapter=mock", "--account-id=mock-account", "--allow-cleanup"]),
    now: fixedDate(),
  });
  assert.equal(blocked.manifest.finalVerdict, "blocked");
  assert.match(blocked.checks[0]?.detail ?? "", /cleanup-only requires --adapter=wrangler/);
}

function restoreEnv(key: string, value: string | undefined) {
  if (value === undefined) delete process.env[key];
  else process.env[key] = value;
}

function testWranglerFixtures() {
  const fixtureDir = path.join(process.cwd(), "tools", "starter", "fixtures", "wrangler", "4.105.0");
  const expectations: Record<string, string> = {
    "standard-success.json": "parsed",
    "stderr-warning.json": "parsed",
    "missing-fields.json": "failed",
    "format-change.json": "failed",
    "non-zero-exit.json": "failed",
    "interactive-prompt.json": "blocked",
    "empty-output.json": "failed",
    "truncated-output.json": "failed",
  };
  for (const [file, status] of Object.entries(expectations)) {
    const fixture = JSON.parse(readFileSync(path.join(fixtureDir, file), "utf8")) as Omit<WranglerOutputInput, "version" | "args" | "durationMs">;
    const parsed = parseWranglerOutput({ version: "4.105.0", args: ["--json"], durationMs: 10, ...fixture });
    assert.equal(parsed.status, status, file);
  }
}

function fixedDate() {
  return new Date("2026-08-04T00:00:00.000Z");
}

function cleanIntegrationOutput(prefix: string) {
  const operationId = `it-${cryptoHash(prefix).slice(0, 16)}`;
  const dir = path.join(process.cwd(), ".contentforge", "integration", operationId);
  if (existsSync(dir)) rmSync(dir, { recursive: true, force: true });
}

function cryptoHash(value: string) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
