import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { createControlledAdapter } from "../tools/starter/cloudflare-adapter";
import { parseRemoteExecutionArgs } from "../tools/starter/cloudflare-execution";
import { runControlledCloudflareWorkflow } from "../tools/starter/cloudflare-workflows";
import { rollbackProductionConfig } from "../tools/starter/production-config-patch";
import type { BootstrapConfigInput } from "../tools/starter/production-bootstrap";

async function main() {
  testFlagAliases();
  await testFormalExecuteConvergence();
  console.log("PASS production execute convergence tests");
}

function testFlagAliases() {
  const aliases = parseRemoteExecutionArgs([
    "--execute",
    "--adapter=wrangler",
    "--account-id=acct",
    "--approved-plan-hash=hash",
    "--allow-d1-create",
    "--allow-r2-create",
    "--allow-secret-write",
    "--allow-d1-execute",
    "--allow-r2-probe",
    "--allow-cleanup",
    "--yes",
  ]);
  assert.equal(aliases.allowFlags.allowCreateD1, true);
  assert.equal(aliases.allowFlags.allowCreateR2, true);
  assert.equal(aliases.allowFlags.allowSetSecrets, true);
  assert.equal(aliases.allowFlags.allowD1Write, true);
  assert.equal(aliases.allowFlags.allowR2Probe, true);
  assert.equal(aliases.allowFlags.allowCleanup, true);
  assert.equal(aliases.yes, true);

  const yesOnly = parseRemoteExecutionArgs(["--execute", "--yes", "--account-id=acct"]);
  assert.equal(yesOnly.allowFlags.allowCreateD1, false);
  assert.equal(yesOnly.allowFlags.allowDeploy, false);
  assert.equal(yesOnly.allowFlags.allowSetSecrets, false);
}

async function testFormalExecuteConvergence() {
  const secret = process.env.CONTENTFORGE_ADMIN_PASSWORD;
  process.env.CONTENTFORGE_ADMIN_PASSWORD = "mock-admin-secret-12345";
  process.env.CONTENTFORGE_SESSION_SECRET = "mock-session-secret-12345678901234567890";
  try {
    const config = validConfig();
    const planAdapter = createControlledAdapter("mock");
    const plan = await runControlledCloudflareWorkflow({
      config,
      options: parseRemoteExecutionArgs(["--remote-plan", "--adapter=mock", "--account-id=mock-account"]),
      adapter: planAdapter,
    });
    assert.equal(plan.mode, "remote-plan");
    assert.match(plan.planHash, /^[a-f0-9]{64}$/);

    const executeAdapter = createControlledAdapter("mock");
    const report = await runControlledCloudflareWorkflow({
      config,
      options: parseRemoteExecutionArgs([
        "--execute",
        "--adapter=mock",
        "--account-id=mock-account",
        `--approved-plan-hash=${plan.planHash}`,
        "--allow-create-d1",
        "--allow-create-r2",
        "--allow-config-patch",
        "--allow-deploy",
        "--allow-set-secrets",
        "--allow-d1-write",
        "--allow-bootstrap-seed",
        "--allow-r2-probe",
      ]),
      adapter: executeAdapter,
    });

    assert.equal(report.summary, "passed");
    assert(report.executionReportPath);
    assert(executeAdapter.callLog.includes("putR2Object"));
    assert(executeAdapter.callLog.includes("getR2Object"));
    assert(executeAdapter.callLog.includes("deleteR2Object"));

    const reportPath = ".contentforge/production-execution-report.json";
    assert(existsSync(reportPath));
    const payload = JSON.parse(readFileSync(reportPath, "utf8")) as {
      verdict?: string;
      r2Probe?: { verified?: boolean };
      domainDnsStatus?: string;
    };
    assert.equal(payload.verdict, "production-execution-complete");
    assert.equal(payload.r2Probe?.verified, true);
    assert.equal(payload.domainDnsStatus, "not-run-default-closed-loop");
  } finally {
    rollbackLatestPatchIfNeeded();
    if (secret === undefined) delete process.env.CONTENTFORGE_ADMIN_PASSWORD;
    else process.env.CONTENTFORGE_ADMIN_PASSWORD = secret;
    delete process.env.CONTENTFORGE_SESSION_SECRET;
  }
}

function rollbackLatestPatchIfNeeded() {
  const reportPath = ".contentforge/production-execution-report.json";
  if (!existsSync(reportPath)) return;
  const payload = JSON.parse(readFileSync(reportPath, "utf8")) as { patchOperationId?: string };
  if (payload.patchOperationId) rollbackProductionConfig({ operationId: payload.patchOperationId });
}

function validConfig(): BootstrapConfigInput {
  return {
    siteName: "Production Execute Convergence",
    siteSlug: "contentforge-it-converge",
    siteUrl: "https://contentforge-it-converge-worker.workers.dev",
    canonicalHost: "contentforge-it-converge-worker.workers.dev",
    workerName: "contentforge-it-converge-worker",
    d1DatabaseName: "contentforge-it-converge-d1",
    d1DatabaseId: "00000000-0000-0000-0000-000000000000",
    r2BucketName: "contentforge-it-converge-media",
    r2PublicBaseUrl: "https://contentforge-it-converge-worker.workers.dev/media",
    customDomain: "",
    wwwRedirect: false,
    cloudflareAccountId: "mock-account",
    productionFallback: false,
    deploymentEnvironment: "production",
  };
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
