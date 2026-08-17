import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";

import { patchProductionConfig, validateProductionConfig, type ProductionResourcePatch } from "../tools/starter/production-config-patch";

function main() {
  testSuccessfulTwoFilePatch();
  testValidationFailures();
  console.log("PASS production config patch tests");
}

function testSuccessfulTwoFilePatch() {
  const root = fixtureRoot("success");
  writeValidFiles(root);
  const patch = validPatch("patch-success");
  const result = patchProductionConfig(patch, { root });
  assert.equal(result.ok, true);
  assert.deepEqual(result.changedFiles.sort(), ["starter.site.json", "wrangler.jsonc"]);
  assert.equal(result.validation.ok, true);
  assert.equal(result.rollbackAvailable, true);
  assert(existsSync(path.join(root, ".contentforge", "production-patches", patch.operationId, "manifest.json")));

  const wrangler = readFileSync(path.join(root, "wrangler.jsonc"), "utf8");
  const starter = readFileSync(path.join(root, "starter.site.json"), "utf8");
  assert(wrangler.includes("// keep this comment"));
  assert(wrangler.includes('"database_id": "11111111-1111-4111-8111-111111111111"'));
  assert(starter.includes('"githubRepo": "https://github.com/example/repo.git"'));
  assert(starter.includes('"themeName": "homerio"'));
  assert(!JSON.stringify(result).includes("super-secret"));
}

function testValidationFailures() {
  const root = fixtureRoot("invalid");
  writeValidFiles(root);
  const placeholder = patchProductionConfig({ ...validPatch("patch-placeholder"), d1DatabaseId: "00000000-0000-0000-0000-000000000000" }, { root });
  assert.equal(placeholder.ok, false);
  assert.equal(placeholder.errorCode, "D1_ID_INVALID");

  const invalidUuid = patchProductionConfig({ ...validPatch("patch-invalid-uuid"), d1DatabaseId: "not-a-uuid" }, { root });
  assert.equal(invalidUuid.ok, false);
  assert.equal(invalidUuid.errorCode, "D1_ID_INVALID");

  const validation = validateProductionConfig({
    wranglerContent: readFileSync(path.join(root, "wrangler.jsonc"), "utf8").replace('"binding": "DB"', '"binding": "WRONG"'),
    starterContent: readFileSync(path.join(root, "starter.site.json"), "utf8"),
    patch: validPatch("validate-binding"),
  });
  assert.equal(validation.ok, false);
  assert(validation.codes.includes("BINDING_MISMATCH"));
}

function writeValidFiles(root: string) {
  mkdirSync(root, { recursive: true });
  writeFileSync(
    path.join(root, "wrangler.jsonc"),
    [
      "{",
      '  // keep this comment',
      '  "name": "old-worker",',
      '  "main": ".open-next/worker.js",',
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
        siteName: "Fixture",
        productionUrl: "https://old.example",
        githubRepo: "https://github.com/example/repo.git",
        cloudflareWorkerName: "old-worker",
        d1DatabaseName: "old-db",
        d1DatabaseId: "00000000-0000-0000-0000-000000000000",
        r2BucketName: "old-media",
        themeName: "homerio",
        brandColors: { accent: "#2563eb" },
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
  const root = path.join(process.cwd(), ".contentforge", `test-production-config-patch-${name}`);
  if (existsSync(root)) rmSync(root, { recursive: true, force: true });
  return root;
}

main();
