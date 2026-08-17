import assert from "node:assert/strict";

import { createControlledAdapter } from "../tools/starter/cloudflare-adapter";
import { parseRemoteExecutionArgs } from "../tools/starter/cloudflare-execution";
import { resolveD1SqlSources, verifyD1PostWrite, verifySafeSqlSources } from "../tools/starter/production-phase4";

async function main() {
  testD1AllowFlags();
  testSchemaSourceSafety();
  testBootstrapSeedSeparateAuthorization();
  await testRealD1Gate();
  testPostWriteVerification();
  console.log("PASS production d1 bootstrap tests");
}

function testD1AllowFlags() {
  assert.equal(parseRemoteExecutionArgs(["--allow-d1-execute"]).allowFlags.allowD1Write, true);
  assert.equal(parseRemoteExecutionArgs(["--yes"]).allowFlags.allowD1Write, false);
  assert.equal(parseRemoteExecutionArgs(["--allow-d1-write"]).allowFlags.allowBootstrapSeed, false);
}

function testSchemaSourceSafety() {
  const sources = resolveD1SqlSources({ allowBootstrapSeed: false });
  assert.equal(sources.ok, true);
  const schemaSource = sources.resource?.find((source) => source.purpose === "schema");
  assert.equal(Boolean(schemaSource), true);
  assert.equal(schemaSource?.path, "src/db/migrations/0001_initial.sql");
  assert.match(schemaSource?.sql ?? "", /CREATE TABLE article_tags/);
  assert.equal(verifySafeSqlSources(sources.resource ?? []).ok, true);
  const unsafe = verifySafeSqlSources([{ path: "unsafe.sql", purpose: "schema", hash: "x", statementCount: 1, sql: "BEGIN; CREATE TABLE x(id); COMMIT;" }]);
  assert.equal(unsafe.ok, false);
  assert.equal(unsafe.code, "D1_SQL_TRANSACTION_BLOCKED");
}

function testBootstrapSeedSeparateAuthorization() {
  assert.equal(resolveD1SqlSources({ allowBootstrapSeed: false }).resource?.some((source) => source.purpose === "seed"), false);
  assert.equal(parseRemoteExecutionArgs(["--allow-bootstrap-seed"]).allowFlags.allowBootstrapSeed, true);
}

async function testRealD1Gate() {
  delete process.env.CONTENTFORGE_ENABLE_REAL_CLOUDFLARE_WRITES;
  delete process.env.CONTENTFORGE_ENABLE_REAL_D1_WRITES;
  const result = await createControlledAdapter("wrangler").executeD1("acct", "contentforge-it-db", "CREATE TABLE IF NOT EXISTS x(id TEXT)");
  assert.equal(result.ok, false);
  assert.equal(result.errorCode, "REAL_CLOUDFLARE_WRITE_GATE_BLOCKED");
}

function testPostWriteVerification() {
  assert.equal(verifyD1PostWrite({ schemaExecuted: true, seedExecuted: false }).ok, true);
  assert.equal(verifyD1PostWrite({ schemaExecuted: false, seedExecuted: false }).code, "D1_POST_WRITE_VERIFICATION_FAILED");
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
