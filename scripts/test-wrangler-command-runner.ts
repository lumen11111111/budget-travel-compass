import assert from "node:assert/strict";

import { resolveWranglerCommand, runWranglerCommand, sanitizeWranglerArgs, sanitizeWranglerOutput } from "../tools/starter/wrangler";

async function main() {
  testResolution();
  testSanitization();
  await testVersionRead();
  await testNonZeroExit();
  await testTimeout();
  console.log("PASS wrangler command runner tests");
}

function testResolution() {
  const resolved = resolveWranglerCommand(process.cwd());
  assert.equal(resolved.source, "local");
  assert.equal(resolved.localPinned, true);
  assert(resolved.argsPrefix.some((part) => part.includes("wrangler")));
}

function testSanitization() {
  assert.equal(sanitizeWranglerOutput("Authorization: Bearer abcdefghijklmnopqrstuvwxyz"), "Authorization: ***");
  assert.deepEqual(sanitizeWranglerArgs(["secret", "put", "ADMIN_PASSWORD", "--password", "super-secret"]), ["secret", "put", "ADMIN_PASSWORD", "--password", "***"]);
}

async function testVersionRead() {
  const result = await runWranglerCommand({ args: ["--version"], timeoutMs: 30_000 });
  assert.equal(result.ok, true);
  assert.match(result.stdout, /\d+\.\d+\.\d+/);
  assert.equal(result.source, "local");
  assert.equal(result.localPinned, true);
}

async function testNonZeroExit() {
  const result = await runWranglerCommand({ args: ["definitely-not-a-contentforge-command"], timeoutMs: 30_000 });
  assert.equal(result.ok, false);
  assert.equal(result.exitCode === 0, false);
  assert(result.errorCode);
}

async function testTimeout() {
  const result = await runWranglerCommand({ args: ["d1", "list", "--help"], timeoutMs: 1 });
  assert.equal(result.ok, false);
  assert.equal(result.timedOut, true);
  assert.equal(result.errorCode, "WRANGLER_COMMAND_TIMEOUT");
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
