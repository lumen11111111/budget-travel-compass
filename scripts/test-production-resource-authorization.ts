import assert from "node:assert/strict";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { createControlledAdapter } from "../tools/starter/cloudflare-adapter";
import { parseRemoteExecutionArgs } from "../tools/starter/cloudflare-execution";
import { validateProductionAuthorizationEvidence } from "../tools/starter/production-resource-authorization";
import { runControlledCloudflareWorkflow } from "../tools/starter/cloudflare-workflows";
import { readOperationRecords } from "../tools/starter/production-audit";
import type { BootstrapConfigInput } from "../tools/starter/production-bootstrap";

const accountId = "5a2aabbbd4edcda1fd562a657a270dc7";
const writeCalls = ["createD1Database", "createR2Bucket", "deployWorker", "executeD1", "putR2Object", "deleteR2Object"];

async function main() {
  await withConfig(groupGameHubConfig(), async () => {
    await testProductionNameNoFlagNoEnvBlocked();
    await testOnlyFlagBlocked();
    await testOnlyEnvBlocked();
    await testDirtyGitBlocked();
    await testStalePlanBlocked();
    await testNameMismatchBlocked("worker");
    await testNameMismatchBlocked("d1");
    await testNameMismatchBlocked("r2");
    await testUrlBlocked("http://groupgamehub.com", "PRODUCTION_RESOURCE_URL_INVALID");
    await testUrlBlocked("https://example.com", "PRODUCTION_RESOURCE_URL_INVALID");
    await testUrlBlocked("https://localhost", "PRODUCTION_RESOURCE_URL_INVALID");
    await testPlaceholderNameBlocked();
    await testCleanupFormalResourceBlocked();
    await testDomainDnsFlagsBlocked();
    await testYesDoesNotAuthorize();
    await testGroupGameHubMockAuthorizationEntersWriteStep();
  });
  await testCertificationProductionAuthorizationBlocked();
  await testAdapterEvidenceValidation();
  await testContentforgeItPathUnaffected();
  console.log("PASS production resource authorization tests");
}

async function testProductionNameNoFlagNoEnvBlocked() {
  clearProductionEnv();
  const result = await executeWith(["--allow-config-patch", "--allow-deploy", "--allow-create-d1", "--allow-create-r2", "--allow-set-secrets", "--allow-d1-write", "--allow-bootstrap-seed", "--allow-r2-probe"]);
  assertBlockedBeforeWrites(result, "PRODUCTION_RESOURCE_AUTHORIZATION_REQUIRED");
}

async function testOnlyFlagBlocked() {
  clearProductionEnv();
  const result = await executeWith(["--allow-production-resources", ...allWriteFlags()]);
  assertBlockedBeforeWrites(result, "PRODUCTION_RESOURCE_ENV_GATE_MISSING");
}

async function testOnlyEnvBlocked() {
  process.env.CONTENTFORGE_ENABLE_PRODUCTION_RESOURCE_WRITES = "1";
  const result = await executeWith(allWriteFlags());
  assertBlockedBeforeWrites(result, "PRODUCTION_RESOURCE_AUTHORIZATION_REQUIRED");
  clearProductionEnv();
}

async function testDirtyGitBlocked() {
  process.env.CONTENTFORGE_ENABLE_PRODUCTION_RESOURCE_WRITES = "1";
  delete process.env.CONTENTFORGE_TEST_ASSUME_GIT_CLEAN;
  const result = await executeWith(["--allow-production-resources", ...allWriteFlags()]);
  assertBlockedBeforeWrites(result, "PRODUCTION_RESOURCE_GIT_DIRTY");
  clearProductionEnv();
}

async function testStalePlanBlocked() {
  process.env.CONTENTFORGE_ENABLE_PRODUCTION_RESOURCE_WRITES = "1";
  process.env.CONTENTFORGE_TEST_ASSUME_GIT_CLEAN = "1";
  const config = groupGameHubConfig();
  const adapter = createControlledAdapter("mock");
  const report = await runControlledCloudflareWorkflow({
    config,
    options: parseRemoteExecutionArgs(["--execute", "--adapter=mock", `--account-id=${accountId}`, "--approved-plan-hash=stale", "--allow-production-resources", ...allWriteFlags()]),
    adapter,
  });
  assert.equal(report.summary, "blocked");
  assert(report.checks.some((check) => /Approved plan hash/.test(check.detail)));
  assertNoWriteCalls(adapter.callLog);
  clearProductionEnv();
}

async function testNameMismatchBlocked(kind: "worker" | "d1" | "r2") {
  process.env.CONTENTFORGE_ENABLE_PRODUCTION_RESOURCE_WRITES = "1";
  process.env.CONTENTFORGE_TEST_ASSUME_GIT_CLEAN = "1";
  const config = groupGameHubConfig();
  const snapshot = snapshotFiles();
  try {
    if (kind === "worker") writeFileSync(path.join(process.cwd(), "wrangler.jsonc"), renderWrangler({ ...config, workerName: "different-worker" }), "utf8");
    if (kind === "d1") writeFileSync(path.join(process.cwd(), "wrangler.jsonc"), renderWrangler({ ...config, d1DatabaseName: "different-d1" }), "utf8");
    if (kind === "r2") writeFileSync(path.join(process.cwd(), "wrangler.jsonc"), renderWrangler({ ...config, r2BucketName: "different-r2" }), "utf8");
    const result = await executeWith(["--allow-production-resources", ...allWriteFlags()]);
    assertBlockedBeforeWrites(result, "PRODUCTION_RESOURCE_CONFIG_MISMATCH");
  } finally {
    restoreFiles(snapshot);
    clearProductionEnv();
  }
}

async function testUrlBlocked(siteUrl: string, code: string) {
  process.env.CONTENTFORGE_ENABLE_PRODUCTION_RESOURCE_WRITES = "1";
  process.env.CONTENTFORGE_TEST_ASSUME_GIT_CLEAN = "1";
  const config = { ...groupGameHubConfig(), siteUrl, r2PublicBaseUrl: `${siteUrl}/media` };
  await withConfig(config, async () => {
    const result = await executeWith(["--allow-production-resources", ...allWriteFlags()], config);
    assertBlockedBeforeWrites(result, code);
  });
  clearProductionEnv();
}

async function testPlaceholderNameBlocked() {
  process.env.CONTENTFORGE_ENABLE_PRODUCTION_RESOURCE_WRITES = "1";
  process.env.CONTENTFORGE_TEST_ASSUME_GIT_CLEAN = "1";
  const config = { ...groupGameHubConfig(), workerName: "contentforge-site" };
  await withConfig(config, async () => {
    const result = await executeWith(["--allow-production-resources", ...allWriteFlags()], config);
    assertBlockedBeforeWrites(result, "PRODUCTION_RESOURCE_NAME_INVALID");
  });
  clearProductionEnv();
}

async function testCleanupFormalResourceBlocked() {
  process.env.CONTENTFORGE_ENABLE_PRODUCTION_RESOURCE_WRITES = "1";
  process.env.CONTENTFORGE_TEST_ASSUME_GIT_CLEAN = "1";
  const result = await executeWith(["--allow-production-resources", "--allow-cleanup", ...allWriteFlags()]);
  assertBlockedBeforeWrites(result, "PRODUCTION_RESOURCE_CLEANUP_FORBIDDEN");
  clearProductionEnv();
}

async function testDomainDnsFlagsBlocked() {
  process.env.CONTENTFORGE_ENABLE_PRODUCTION_RESOURCE_WRITES = "1";
  process.env.CONTENTFORGE_TEST_ASSUME_GIT_CLEAN = "1";
  const result = await executeWith(["--allow-production-resources", "--allow-domain-change", "--allow-dns-change", ...allWriteFlags()]);
  assertBlockedBeforeWrites(result, "PRODUCTION_RESOURCE_AUTHORIZATION_REQUIRED");
  clearProductionEnv();
}

async function testYesDoesNotAuthorize() {
  process.env.CONTENTFORGE_ENABLE_PRODUCTION_RESOURCE_WRITES = "1";
  process.env.CONTENTFORGE_TEST_ASSUME_GIT_CLEAN = "1";
  const result = await executeWith(["--yes", ...allWriteFlags()]);
  assertBlockedBeforeWrites(result, "PRODUCTION_RESOURCE_AUTHORIZATION_REQUIRED");
  clearProductionEnv();
}

async function testGroupGameHubMockAuthorizationEntersWriteStep() {
  process.env.CONTENTFORGE_ENABLE_PRODUCTION_RESOURCE_WRITES = "1";
  process.env.CONTENTFORGE_TEST_ASSUME_GIT_CLEAN = "1";
  process.env.CONTENTFORGE_ADMIN_PASSWORD = "mock-admin-secret-12345";
  process.env.CONTENTFORGE_SESSION_SECRET = "mock-session-secret-12345";
  const result = await executeWith(["--allow-production-resources", ...allWriteFlags()], groupGameHubConfig(), { failNext: "createD1Database" });
  assert.equal(result.report.summary, "failed");
  assert(result.adapter.callLog.includes("createD1Database"));
  const payload = readReport();
  assert.equal(payload.productionResourceAuthorization, true);
  assert.equal(payload.productionResourceAuthorizationRequested, true);
  assert.equal(payload.productionResourceEnvironmentEnabled, true);
  assert.match(String(payload.productionResourceSetHash), /^[a-f0-9]{64}$/);
  clearProductionEnv();
  delete process.env.CONTENTFORGE_ADMIN_PASSWORD;
  delete process.env.CONTENTFORGE_SESSION_SECRET;
}

async function testCertificationProductionAuthorizationBlocked() {
  process.env.CONTENTFORGE_ENABLE_PRODUCTION_RESOURCE_WRITES = "1";
  process.env.CONTENTFORGE_TEST_ASSUME_GIT_CLEAN = "1";
  const config = testResourceConfig();
  const first = await runControlledCloudflareWorkflow({ config, options: parseRemoteExecutionArgs(["--remote-plan", "--adapter=mock", `--account-id=${accountId}`]), adapter: createControlledAdapter("mock") });
  const report = await runControlledCloudflareWorkflow({
    config,
    options: parseRemoteExecutionArgs(["--execute", "--adapter=mock", `--account-id=${accountId}`, `--approved-plan-hash=${first.planHash}`, "--allow-production-resources", ...allWriteFlags()]),
    adapter: createControlledAdapter("mock"),
  });
  assert.equal(report.summary, "blocked");
  assert(report.checks.some((check) => check.detail.includes("PRODUCTION_RESOURCE_CERTIFICATION_FORBIDDEN")));
  clearProductionEnv();
}

async function testAdapterEvidenceValidation() {
  const missing = validateProductionAuthorizationEvidence({ accountId, resourceName: "groupgamehub", operation: "deploy" });
  assert.equal(missing.ok, false);
  assert.equal(missing.code, "PRODUCTION_RESOURCE_AUTHORIZATION_REQUIRED");
  const mismatch = validateProductionAuthorizationEvidence({
    accountId,
    resourceName: "groupgamehub",
    operation: "deploy",
    evidence: {
      authorized: true,
      planHash: "a",
      expectedPlanHash: "b",
      accountId,
      resourceSetHash: "bad",
      resourceNames: ["groupgamehub", "groupgamehub", "groupgamehub-media"],
      workerName: "groupgamehub",
      d1DatabaseName: "groupgamehub",
      r2BucketName: "groupgamehub-media",
    },
  });
  assert.equal(mismatch.ok, false);
}

async function testContentforgeItPathUnaffected() {
  clearProductionEnv();
  const config = testResourceConfig();
  const first = await runControlledCloudflareWorkflow({ config, options: parseRemoteExecutionArgs(["--remote-plan", "--adapter=mock", `--account-id=${accountId}`]), adapter: createControlledAdapter("mock") });
  const adapter = createControlledAdapter("mock", { failNext: "createD1Database" });
  const report = await runControlledCloudflareWorkflow({
    config,
    options: parseRemoteExecutionArgs(["--execute", "--adapter=mock", `--account-id=${accountId}`, `--approved-plan-hash=${first.planHash}`, ...allWriteFlags()]),
    adapter,
  });
  assert.equal(report.summary, "failed");
  assert(adapter.callLog.includes("createD1Database"));
}

async function executeWith(args: string[], config = groupGameHubConfig(), fixture: { failNext?: string } = {}) {
  const beforeRecords = readOperationRecords().length;
  const beforeFiles = snapshotFiles();
  const plan = await runControlledCloudflareWorkflow({ config, options: parseRemoteExecutionArgs(["--remote-plan", "--adapter=mock", `--account-id=${accountId}`]), adapter: createControlledAdapter("mock") });
  const adapter = createControlledAdapter("mock", fixture);
  const report = await runControlledCloudflareWorkflow({
    config,
    options: parseRemoteExecutionArgs(["--execute", "--adapter=mock", `--account-id=${accountId}`, `--approved-plan-hash=${plan.planHash}`, ...args]),
    adapter,
  });
  return { report, adapter, beforeRecords, beforeFiles };
}

function assertBlockedBeforeWrites(result: Awaited<ReturnType<typeof executeWith>>, code: string) {
  assert.equal(result.report.summary, "blocked");
  assert(result.report.checks.some((check) => check.detail.includes(code)), `${code} not found in checks`);
  assertNoWriteCalls(result.adapter.callLog);
  assert.deepEqual(snapshotFiles(), result.beforeFiles);
  assert.equal(readOperationRecords().length, result.beforeRecords);
  const payload = readReport();
  assert.equal(Array.isArray(payload.actualResults) ? payload.actualResults.length : -1, 0);
}

function assertNoWriteCalls(callLog: string[]) {
  assert(!callLog.some((call) => writeCalls.some((write) => call === write || call.startsWith(`${write}:`))), `unexpected write call: ${callLog.join(",")}`);
}

function allWriteFlags() {
  return ["--allow-create-d1", "--allow-create-r2", "--allow-config-patch", "--allow-deploy", "--allow-set-secrets", "--allow-d1-write", "--allow-bootstrap-seed", "--allow-r2-probe"];
}

async function withConfig(config: BootstrapConfigInput, fn: () => Promise<void>) {
  const snapshot = snapshotFiles();
  try {
    writeFileSync(path.join(process.cwd(), "wrangler.jsonc"), renderWrangler(config), "utf8");
    writeFileSync(path.join(process.cwd(), "starter.site.json"), renderStarter(config), "utf8");
    await fn();
  } finally {
    restoreFiles(snapshot);
  }
}

function snapshotFiles() {
  return {
    wrangler: readFileSync(path.join(process.cwd(), "wrangler.jsonc"), "utf8"),
    starter: readFileSync(path.join(process.cwd(), "starter.site.json"), "utf8"),
  };
}

function restoreFiles(snapshot: { wrangler: string; starter: string }) {
  writeFileSync(path.join(process.cwd(), "wrangler.jsonc"), snapshot.wrangler, "utf8");
  writeFileSync(path.join(process.cwd(), "starter.site.json"), snapshot.starter, "utf8");
}

function readReport() {
  const reportPath = path.join(process.cwd(), ".contentforge", "production-execution-report.json");
  return existsSync(reportPath) ? JSON.parse(readFileSync(reportPath, "utf8")) as Record<string, unknown> : {};
}

function clearProductionEnv() {
  delete process.env.CONTENTFORGE_ENABLE_PRODUCTION_RESOURCE_WRITES;
  delete process.env.CONTENTFORGE_TEST_ASSUME_GIT_CLEAN;
}

function groupGameHubConfig(): BootstrapConfigInput {
  return {
    siteName: "Group Game Hub",
    siteSlug: "group-game-hub",
    siteUrl: "https://groupgamehub.com",
    canonicalHost: "groupgamehub.com",
    workerName: "groupgamehub",
    d1DatabaseName: "groupgamehub",
    d1DatabaseId: "00000000-0000-0000-0000-000000000000",
    r2BucketName: "groupgamehub-media",
    r2PublicBaseUrl: "https://groupgamehub.com/media",
    customDomain: "groupgamehub.com",
    wwwRedirect: true,
    cloudflareAccountId: accountId,
    productionFallback: false,
    deploymentEnvironment: "production",
  };
}

function testResourceConfig(): BootstrapConfigInput {
  return {
    ...groupGameHubConfig(),
    siteName: "ContentForge Test Resource",
    siteSlug: "contentforge-it-resource",
    siteUrl: "https://contentforge-it-resource.example.workers.dev",
    canonicalHost: "contentforge-it-resource.example.workers.dev",
    workerName: "contentforge-it-resource-worker",
    d1DatabaseName: "contentforge-it-resource-d1",
    r2BucketName: "contentforge-it-resource-media",
    r2PublicBaseUrl: "https://contentforge-it-resource.example.workers.dev/media",
    customDomain: "",
  };
}

function renderWrangler(config: BootstrapConfigInput) {
  return JSON.stringify({
    $schema: "node_modules/wrangler/config-schema.json",
    name: config.workerName,
    main: ".open-next/worker.js",
    compatibility_date: "2026-06-30",
    compatibility_flags: ["nodejs_compat"],
    assets: { directory: ".open-next/assets", binding: "ASSETS", run_worker_first: true },
    d1_databases: [{ binding: "DB", database_name: config.d1DatabaseName, database_id: config.d1DatabaseId }],
    r2_buckets: [{ binding: "MEDIA_BUCKET", bucket_name: config.r2BucketName }],
    vars: { NEXT_PUBLIC_SITE_URL: config.siteUrl, R2_PUBLIC_BASE_URL: config.r2PublicBaseUrl },
  }, null, 2);
}

function renderStarter(config: BootstrapConfigInput) {
  return JSON.stringify({
    siteName: config.siteName,
    domain: config.canonicalHost,
    productionUrl: config.siteUrl,
    packageName: config.siteSlug,
    githubRepo: "https://github.com/lumen11111111/GroupGameHub.git",
    cloudflareWorkerName: config.workerName,
    d1DatabaseName: config.d1DatabaseName,
    d1DatabaseId: config.d1DatabaseId,
    r2BucketName: config.r2BucketName,
    themeName: "game-editorial",
  }, null, 2);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
