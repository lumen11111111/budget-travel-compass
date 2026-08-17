import assert from "node:assert/strict";

import { parseWranglerSecretPut } from "../tools/starter/cloudflare-wrangler-output";
import type { WranglerCommandResult } from "../tools/starter/wrangler";

function main() {
  const success = parseWranglerSecretPut(command({ stdout: "Secret ADMIN_PASSWORD uploaded successfully." }), "ADMIN_PASSWORD");
  assert.equal(success.ok, true);
  assert.equal(success.ok && success.value.name, "ADMIN_PASSWORD");

  const failed = parseWranglerSecretPut(command({ exitCode: 1, stderr: "permission denied" }), "ADMIN_PASSWORD");
  assert.equal(failed.ok, false);
  assert.equal(!failed.ok && failed.code, "WRANGLER_PERMISSION_DENIED");

  const prompt = parseWranglerSecretPut(command({ stdout: "Confirm secret write?" }), "SESSION_SECRET");
  assert.equal(prompt.ok, false);
  assert.equal(!prompt.ok && prompt.code, "WRANGLER_INTERACTIVE_PROMPT");

  const unknown = parseWranglerSecretPut(command({ stdout: "Updated configuration." }), "SESSION_SECRET");
  assert.equal(unknown.ok, false);

  console.log("PASS wrangler secret parser tests");
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
