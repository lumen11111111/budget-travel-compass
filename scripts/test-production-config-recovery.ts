import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";

import {
  findUnfinishedProductionPatches,
  patchProductionConfig,
  recoverProductionPatch,
  rollbackProductionConfig,
  type ProductionResourcePatch,
} from "../tools/starter/production-config-patch";

function main() {
  testSecondFileFailureRollsBackFirst();
  testRollbackTargetChangedBlocked();
  testExplicitRecovery();
  testInvalidOperationId();
  console.log("PASS production config recovery tests");
}

function testSecondFileFailureRollsBackFirst() {
  const root = fixtureRoot("rollback-first");
  writeValidFiles(root);
  const beforeWrangler = readFileSync(path.join(root, "wrangler.jsonc"), "utf8");
  const beforeStarter = readFileSync(path.join(root, "starter.site.json"), "utf8");
  const result = patchProductionConfig(validPatch("patch-fail-after-first"), { root, failAfterFirstWrite: true });
  assert.equal(result.ok, false);
  assert(["PATCH_WRITE_FAILED", "ROLLBACK_FAILED"].includes(result.errorCode ?? ""));
  assert.equal(readFileSync(path.join(root, "wrangler.jsonc"), "utf8"), beforeWrangler);
  assert.equal(readFileSync(path.join(root, "starter.site.json"), "utf8"), beforeStarter);
}

function testRollbackTargetChangedBlocked() {
  const root = fixtureRoot("target-changed");
  writeValidFiles(root);
  const patch = validPatch("patch-target-changed");
  const result = patchProductionConfig(patch, { root });
  assert.equal(result.ok, true);
  writeFileSync(path.join(root, "wrangler.jsonc"), `${readFileSync(path.join(root, "wrangler.jsonc"), "utf8")}\n// manual edit\n`, "utf8");
  const rollback = rollbackProductionConfig({ operationId: patch.operationId, root });
  assert.equal(rollback.ok, false);
  assert.equal(rollback.errorCode, "ROLLBACK_BLOCKED_TARGET_CHANGED");
}

function testExplicitRecovery() {
  const root = fixtureRoot("recovery");
  writeValidFiles(root);
  const patch = validPatch("patch-recovery");
  const result = patchProductionConfig(patch, { root });
  assert.equal(result.ok, true);
  const manifestPath = path.join(root, ".contentforge", "production-patches", patch.operationId, "manifest.json");
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as Record<string, unknown>;
  manifest.status = "rollback-required";
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  assert(findUnfinishedProductionPatches(root).some((item) => item.operationId === patch.operationId));
  const recovery = recoverProductionPatch({ operationId: patch.operationId, root });
  assert.equal(recovery.ok, true);
  assert(!readFileSync(path.join(root, "wrangler.jsonc"), "utf8").includes("new-db"));
}

function testInvalidOperationId() {
  const root = fixtureRoot("invalid-op");
  writeValidFiles(root);
  const result = rollbackProductionConfig({ operationId: "missing-operation", root });
  assert.equal(result.ok, false);
  assert.equal(result.errorCode, "RECOVERY_INVALID_OPERATION_ID");
}

function writeValidFiles(root: string) {
  mkdirSync(root, { recursive: true });
  writeFileSync(
    path.join(root, "wrangler.jsonc"),
    [
      "{",
      '  "name": "old-worker",',
      '  "compatibility_date": "2026-06-30",',
      '  "compatibility_flags": ["nodejs_compat"],',
      '  "d1_databases": [{ "binding": "DB", "database_name": "old-db", "database_id": "00000000-0000-0000-0000-000000000000" }],',
      '  "r2_buckets": [{ "binding": "MEDIA_BUCKET", "bucket_name": "old-media" }],',
      '  "vars": { "NEXT_PUBLIC_SITE_URL": "https://old.example", "R2_PUBLIC_BASE_URL": "https://old.example/media" }',
      "}",
      "",
    ].join("\n"),
    "utf8",
  );
  writeFileSync(
    path.join(root, "starter.site.json"),
    `${JSON.stringify(
      {
        productionUrl: "https://old.example",
        githubRepo: "https://github.com/example/repo.git",
        cloudflareWorkerName: "old-worker",
        d1DatabaseName: "old-db",
        d1DatabaseId: "00000000-0000-0000-0000-000000000000",
        r2BucketName: "old-media",
        themeName: "homerio",
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
}

function validPatch(operationId: string): ProductionResourcePatch {
  return {
    operationId,
    executionPlanHash: "plan-hash",
    accountId: "mock-account",
    adapter: "mock",
    workerName: "new-worker",
    d1DatabaseName: "new-db",
    d1DatabaseId: "11111111-1111-4111-8111-111111111111",
    r2BucketName: "new-media",
    siteUrl: "https://new.example",
    r2PublicBaseUrl: "https://new.example/media",
  };
}

function fixtureRoot(name: string) {
  const root = path.join(process.cwd(), ".contentforge", `test-production-config-recovery-${name}`);
  if (existsSync(root)) rmSync(root, { recursive: true, force: true });
  return root;
}

main();
