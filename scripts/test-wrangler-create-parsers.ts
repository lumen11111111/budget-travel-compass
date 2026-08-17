import assert from "node:assert/strict";

import { parseWranglerD1Create, parseWranglerR2BucketCreate } from "../tools/starter/cloudflare-wrangler-output";
import type { WranglerCommandResult } from "../tools/starter/wrangler";

function main() {
  testD1CreateParser();
  testR2CreateParser();
  console.log("PASS wrangler create parser tests");
}

function testD1CreateParser() {
  const success = parseWranglerD1Create(command({ stdout: '{"result":{"uuid":"11111111-1111-4111-8111-111111111111","database_name":"site-db"}}' }));
  assert.equal(success.ok, true);
  assert.equal(success.ok && success.value.id, "11111111-1111-4111-8111-111111111111");
  assert.equal(success.ok && success.value.name, "site-db");

  const warningPlusSuccess = parseWranglerD1Create(command({ stdout: 'Warning: noisy\n{"database_id":"22222222-2222-4222-8222-222222222222","name":"other-db"}\n' }));
  assert.equal(warningPlusSuccess.ok, true);
  assert.equal(warningPlusSuccess.ok && warningPlusSuccess.value.name, "other-db");

  const missingId = parseWranglerD1Create(command({ stdout: '{"result":{"database_name":"missing-id"}}' }));
  assert.equal(missingId.ok, false);
  assert.equal(!missingId.ok && missingId.code, "WRANGLER_D1_CREATE_MISSING_ID");

  const malformed = parseWranglerD1Create(command({ stdout: "created database without json" }));
  assert.equal(malformed.ok, false);

  const denied = parseWranglerD1Create(command({ exitCode: 1, stderr: "permission denied" }));
  assert.equal(denied.ok, false);
  assert.equal(!denied.ok && denied.code, "WRANGLER_PERMISSION_DENIED");
}

function testR2CreateParser() {
  const json = parseWranglerR2BucketCreate(command({ stdout: '{"result":{"name":"site-media","location":"WNAM"}}' }), "site-media");
  assert.equal(json.ok, true);
  assert.equal(json.ok && json.value.name, "site-media");

  const text = parseWranglerR2BucketCreate(command({ stdout: 'Created bucket "site-media".' }), "site-media");
  assert.equal(text.ok, true);
  assert.equal(text.ok && text.value.name, "site-media");

  const mismatch = parseWranglerR2BucketCreate(command({ stdout: 'Created bucket "other-media".' }), "site-media");
  assert.equal(mismatch.ok, false);
  assert.equal(!mismatch.ok && mismatch.code, "WRANGLER_R2_CREATE_NAME_MISMATCH");

  const prompt = parseWranglerR2BucketCreate(command({ stdout: "Would you like to continue?" }), "site-media");
  assert.equal(prompt.ok, false);
  assert.equal(!prompt.ok && prompt.code, "WRANGLER_INTERACTIVE_PROMPT");
}

function command(input: Partial<WranglerCommandResult>): WranglerCommandResult {
  const output = `${input.stdout ?? ""}\n${input.stderr ?? ""}`;
  return {
    ok: input.ok ?? input.exitCode === 0,
    command: "wrangler",
    args: [],
    sanitizedArgs: [],
    exitCode: input.exitCode ?? 0,
    signal: null,
    stdout: input.stdout ?? "",
    stderr: input.stderr ?? "",
    durationMs: 1,
    timedOut: input.timedOut ?? false,
    interactivePromptDetected: input.interactivePromptDetected ?? /would you like|log in|confirm/i.test(output),
    errorCode: input.errorCode,
    source: "local",
    localPinned: true,
  };
}

main();
