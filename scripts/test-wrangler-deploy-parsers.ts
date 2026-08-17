import assert from "node:assert/strict";

import { parseWranglerDeploy } from "../tools/starter/cloudflare-wrangler-output";
import type { WranglerCommandResult } from "../tools/starter/wrangler";

function main() {
  const json = parseWranglerDeploy(command({ stdout: '{"name":"contentforge-it-worker","version_id":"v1","deployment_id":"d1","url":"https://contentforge-it-worker.example.workers.dev"}' }), "contentforge-it-worker");
  assert.equal(json.ok, true);
  assert.equal(json.ok && json.value.workerName, "contentforge-it-worker");

  const text = parseWranglerDeploy(command({ stdout: "Uploaded contentforge-it-worker\nVersion ID: v2\nhttps://contentforge-it-worker.example.workers.dev" }), "contentforge-it-worker");
  assert.equal(text.ok, true);

  const wrong = parseWranglerDeploy(command({ stdout: '{"name":"other-worker","version_id":"v1"}' }), "contentforge-it-worker");
  assert.equal(wrong.ok, false);
  assert.equal(!wrong.ok && wrong.code, "WRANGLER_DEPLOY_WRONG_WORKER_NAME");

  const productionName = parseWranglerDeploy(
    command({ stdout: "Uploaded groupgamehub\nVersion ID: v2\nhttps://groupgamehub.example.workers.dev" }),
    "groupgamehub",
  );
  assert.equal(productionName.ok, true);
  assert.equal(productionName.ok && productionName.value.workerName, "groupgamehub");

  const productionWrong = parseWranglerDeploy(
    command({ stdout: "Uploaded different-worker\nVersion ID: v2\nhttps://different-worker.example.workers.dev" }),
    "groupgamehub",
  );
  assert.equal(productionWrong.ok, false);
  assert.equal(!productionWrong.ok && productionWrong.code, "WRANGLER_DEPLOY_WRONG_WORKER_NAME");

  const missing = parseWranglerDeploy(command({ stdout: '{"version_id":"v1"}' }), "contentforge-it-worker");
  assert.equal(missing.ok, false);

  const prompt = parseWranglerDeploy(command({ stdout: "Would you like to continue?" }), "contentforge-it-worker");
  assert.equal(prompt.ok, false);
  assert.equal(!prompt.ok && prompt.code, "WRANGLER_INTERACTIVE_PROMPT");

  console.log("PASS wrangler deploy parser tests");
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
