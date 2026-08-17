import assert from "node:assert/strict";

import { parseWranglerD1Execute } from "../tools/starter/cloudflare-wrangler-output";
import type { WranglerCommandResult } from "../tools/starter/wrangler";

function main() {
  const json = parseWranglerD1Execute(command({ stdout: '{"success":true,"rows_written":3,"duration_ms":12}' }));
  assert.equal(json.ok, true);
  assert.equal(json.ok && json.value.rowsWritten, 3);

  const text = parseWranglerD1Execute(command({ stdout: "Executed 2 statements successfully." }));
  assert.equal(text.ok, true);

  const sqlError = parseWranglerD1Execute(command({ exitCode: 1, stderr: "SQL error: no such table" }));
  assert.equal(sqlError.ok, false);
  assert.equal(!sqlError.ok && sqlError.code, "WRANGLER_COMMAND_FAILED");

  const prompt = parseWranglerD1Execute(command({ stdout: "Would you like to log in?" }));
  assert.equal(prompt.ok, false);
  assert.equal(!prompt.ok && prompt.code, "WRANGLER_INTERACTIVE_PROMPT");

  console.log("PASS wrangler d1 execute parser tests");
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
