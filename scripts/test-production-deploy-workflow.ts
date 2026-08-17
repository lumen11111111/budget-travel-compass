import assert from "node:assert/strict";

import { createControlledAdapter } from "../tools/starter/cloudflare-adapter";
import { createOperationPlan, decideOperation, parseRemoteExecutionArgs } from "../tools/starter/cloudflare-execution";
import { buildProductionArtifact } from "../tools/starter/production-phase4";

async function main() {
  await testMockBuildDoesNotRunDeployBuild();
  testDeployMissingAllow();
  await testRealDeployGate();
  await testDeployFailureBlocksSecretByAdapterOrder();
  console.log("PASS production deploy workflow tests");
}

async function testMockBuildDoesNotRunDeployBuild() {
  const result = await buildProductionArtifact({ adapterMode: "mock" });
  assert.equal(result.ok, true);
  assert.equal(result.resource?.command, "mock deploy:build");
}

function testDeployMissingAllow() {
  const plan = createOperationPlan({
    stepId: "deploy",
    accountId: "acct",
    resourceType: "deploy",
    resourceName: "contentforge-it-worker",
    action: "deploy-worker",
    riskLevel: 3,
    ownership: "owned",
    requiredAllowFlags: ["allowDeploy"],
    previousState: "prepared",
    resultingState: "deployed",
  });
  const decision = decideOperation(plan, parseRemoteExecutionArgs(["--execute", "--account-id=acct"]));
  assert.equal(decision.status, "blocked");
  assert.deepEqual(decision.missingAllowFlags, ["allowDeploy"]);
}

async function testRealDeployGate() {
  delete process.env.CONTENTFORGE_ENABLE_REAL_CLOUDFLARE_WRITES;
  delete process.env.CONTENTFORGE_ENABLE_REAL_WORKER_DEPLOY;
  const result = await createControlledAdapter("wrangler").deployWorker("acct", "contentforge-it-worker");
  assert.equal(result.ok, false);
  assert.equal(result.errorCode, "REAL_CLOUDFLARE_WRITE_GATE_BLOCKED");
}

async function testDeployFailureBlocksSecretByAdapterOrder() {
  const adapter = createControlledAdapter("mock", { failNext: "deployWorker" });
  const deploy = await adapter.deployWorker("acct", "contentforge-it-worker");
  assert.equal(deploy.ok, false);
  assert(!adapter.callLog.some((entry) => entry.startsWith("putWorkerSecret")));
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
