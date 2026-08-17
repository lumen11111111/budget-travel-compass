import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";

import { createControlledAdapter } from "../tools/starter/cloudflare-adapter";
import { parseRemoteExecutionArgs } from "../tools/starter/cloudflare-execution";
import { runControlledCloudflareWorkflow } from "../tools/starter/cloudflare-workflows";
import type { BootstrapConfigInput } from "../tools/starter/production-bootstrap";

async function main() {
  testResumeArgsDoNotTrustStaleReport();
  await testSecretFailureResumeCompletesWithoutRepeatingPriorSteps();
  console.log("PASS production resume tests");
}

function testResumeArgsDoNotTrustStaleReport() {
  const reportPath = path.join(process.cwd(), ".contentforge", "production-execution-report.json");
  const backup = existsSync(reportPath) ? readFileSync(reportPath, "utf8") : undefined;
  try {
    mkdirSync(path.dirname(reportPath), { recursive: true });
    writeFileSync(reportPath, `${JSON.stringify({ planHash: "old", actualResults: [{ stepId: "deploy", outcome: "success" }] }, null, 2)}\n`, "utf8");
    const parsed = parseRemoteExecutionArgs(["--execute", "--resume", "--approved-plan-hash=new"]);
    assert.equal(parsed.resume, true);
    assert.equal(parsed.approvedPlanHash, "new");
    const loaded = JSON.parse(readFileSync(reportPath, "utf8")) as { planHash: string; actualResults: Array<{ stepId: string; outcome: string }> };
    assert.notEqual(loaded.planHash, parsed.approvedPlanHash);
    assert(loaded.actualResults.some((step) => step.stepId === "deploy" && step.outcome === "success"));
  } finally {
    if (backup === undefined) rmSync(reportPath, { force: true });
    else writeFileSync(reportPath, backup, "utf8");
  }
}

async function testSecretFailureResumeCompletesWithoutRepeatingPriorSteps() {
  const snapshot = snapshotFiles();
  const envSnapshot = {
    admin: process.env.CONTENTFORGE_ADMIN_PASSWORD,
    session: process.env.CONTENTFORGE_SESSION_SECRET,
  };
  process.env.CONTENTFORGE_ADMIN_PASSWORD = "mock-admin-secret-12345";
  process.env.CONTENTFORGE_SESSION_SECRET = "mock-session-secret-12345678901234567890";

  try {
    const config = validConfig();
    writeFileSync(path.join(process.cwd(), "wrangler.jsonc"), renderWrangler(config), "utf8");
    writeFileSync(path.join(process.cwd(), "starter.site.json"), renderStarter(config), "utf8");
    writeFileSync(path.join(process.cwd(), "data", "d1-seed.sql"), "INSERT INTO contentforge_bootstrap_markers (key, value) VALUES ('resume-fixture', 'ok');\n", "utf8");

    const plan = await runControlledCloudflareWorkflow({
      config,
      options: parseRemoteExecutionArgs(["--remote-plan", "--adapter=mock", "--account-id=mock-account"]),
      adapter: seededAdapter(),
    });
    assert.equal(plan.summary, "action-required");

    const first = await runControlledCloudflareWorkflow({
      config,
      options: parseRemoteExecutionArgs(["--execute", "--adapter=mock", "--account-id=mock-account", `--approved-plan-hash=${plan.planHash}`, ...allWriteFlags()]),
      adapter: seededAdapter("putWorkerSecret"),
    });
    assert.equal(first.summary, "failed");
    const firstPayload = readReport();
    const firstResults = firstPayload.actualResults as Array<{ stepId: string; outcome: string }>;
    assert(firstResults.some((step) => step.stepId === "deploy" && step.outcome === "success"), "deploy must succeed before secret failure");
    assert(firstResults.some((step) => step.stepId === "secrets" && step.outcome === "failed"), "secret failure must be recorded");
    assert(!firstResults.some((step) => step.stepId === "d1-schema" && step.outcome === "success"), "schema must not continue after secret failure");

    const resumeAdapter = seededAdapter();
    const resumed = await runControlledCloudflareWorkflow({
      config,
      options: parseRemoteExecutionArgs(["--execute", "--resume", "--adapter=mock", "--account-id=mock-account", `--approved-plan-hash=${plan.planHash}`, ...allWriteFlags()]),
      adapter: resumeAdapter,
    });
    assert.equal(resumed.summary, "passed");
    const payload = readReport();
    assert.equal(payload.verdict, "production-execution-complete");
    const results = payload.actualResults as Array<{ stepId: string; outcome: string; evidence?: string }>;
    assert(results.some((step) => step.stepId === "deploy" && step.outcome === "skipped"), "resume must skip previously successful deploy");
    assert(results.some((step) => step.stepId === "secrets" && step.outcome === "success"), "resume must complete secrets");
    assert(results.some((step) => step.stepId === "d1-schema" && step.outcome === "success"), "resume must continue schema");
    assert(results.some((step) => step.stepId === "d1-seed" && step.outcome === "success"), "resume must continue seed");
    assert(results.filter((step) => step.stepId === "r2-probe" && step.outcome === "success").length >= 4, "resume must complete R2 probe");
    assert(!resumeAdapter.callLog.includes("createD1Database"), "resume must not recreate D1 when D1 step already succeeded");
    assert(!resumeAdapter.callLog.includes("createR2Bucket"), "resume must not recreate R2 when R2 step already succeeded");
  } finally {
    restoreFiles(snapshot);
    if (envSnapshot.admin === undefined) delete process.env.CONTENTFORGE_ADMIN_PASSWORD;
    else process.env.CONTENTFORGE_ADMIN_PASSWORD = envSnapshot.admin;
    if (envSnapshot.session === undefined) delete process.env.CONTENTFORGE_SESSION_SECRET;
    else process.env.CONTENTFORGE_SESSION_SECRET = envSnapshot.session;
  }
}

function seededAdapter(failNext?: string) {
  return createControlledAdapter("mock", {
    failNext,
    workers: [{ name: "contentforge-it-resume-worker", accountId: "mock-account" }],
    d1: [{ name: "contentforge-it-resume-d1", id: "11111111-1111-4111-8111-111111111111", accountId: "mock-account" }],
    r2: [{ name: "contentforge-it-resume-media", accountId: "mock-account" }],
    secrets: [],
  });
}

function validConfig(): BootstrapConfigInput {
  return {
    siteName: "Production Resume Fixture",
    siteSlug: "contentforge-it-resume",
    siteUrl: "https://contentforge-it-resume-worker.workers.dev",
    canonicalHost: "contentforge-it-resume-worker.workers.dev",
    workerName: "contentforge-it-resume-worker",
    d1DatabaseName: "contentforge-it-resume-d1",
    d1DatabaseId: "11111111-1111-4111-8111-111111111111",
    r2BucketName: "contentforge-it-resume-media",
    r2PublicBaseUrl: "https://contentforge-it-resume-worker.workers.dev/media",
    customDomain: "",
    wwwRedirect: false,
    cloudflareAccountId: "mock-account",
    productionFallback: false,
    deploymentEnvironment: "production",
  };
}

function allWriteFlags() {
  return ["--allow-create-d1", "--allow-create-r2", "--allow-config-patch", "--allow-deploy", "--allow-set-secrets", "--allow-d1-write", "--allow-bootstrap-seed", "--allow-r2-probe"];
}

function snapshotFiles() {
  return {
    wrangler: readFileSync(path.join(process.cwd(), "wrangler.jsonc"), "utf8"),
    starter: existsSync(path.join(process.cwd(), "starter.site.json")) ? readFileSync(path.join(process.cwd(), "starter.site.json"), "utf8") : undefined,
    report: existsSync(path.join(process.cwd(), ".contentforge", "production-execution-report.json")) ? readFileSync(path.join(process.cwd(), ".contentforge", "production-execution-report.json"), "utf8") : undefined,
    seed: existsSync(path.join(process.cwd(), "data", "d1-seed.sql")) ? readFileSync(path.join(process.cwd(), "data", "d1-seed.sql"), "utf8") : undefined,
  };
}

function restoreFiles(snapshot: { wrangler: string; starter?: string; report?: string; seed?: string }) {
  writeFileSync(path.join(process.cwd(), "wrangler.jsonc"), snapshot.wrangler, "utf8");
  if (snapshot.starter === undefined) rmSync(path.join(process.cwd(), "starter.site.json"), { force: true });
  else writeFileSync(path.join(process.cwd(), "starter.site.json"), snapshot.starter, "utf8");
  const seedPath = path.join(process.cwd(), "data", "d1-seed.sql");
  if (snapshot.seed === undefined) rmSync(seedPath, { force: true });
  else writeFileSync(seedPath, snapshot.seed, "utf8");
  const reportPath = path.join(process.cwd(), ".contentforge", "production-execution-report.json");
  if (snapshot.report === undefined) rmSync(reportPath, { force: true });
  else {
    mkdirSync(path.dirname(reportPath), { recursive: true });
    writeFileSync(reportPath, snapshot.report, "utf8");
  }
}

function readReport() {
  return JSON.parse(readFileSync(path.join(process.cwd(), ".contentforge", "production-execution-report.json"), "utf8")) as Record<string, unknown>;
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
    githubRepo: "https://github.com/lumen11111111/contentforge-framework.git",
    cloudflareWorkerName: config.workerName,
    d1DatabaseName: config.d1DatabaseName,
    d1DatabaseId: config.d1DatabaseId,
    r2BucketName: config.r2BucketName,
    themeName: "freeze-fixture",
  }, null, 2);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
