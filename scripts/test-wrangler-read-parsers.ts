import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import type { ControlledCloudflareAdapter } from "../tools/starter/cloudflare-adapter";
import { parseRemoteExecutionArgs } from "../tools/starter/cloudflare-execution";
import {
  parseWranglerD1List,
  parseWranglerR2BucketList,
  parseWranglerSecretList,
  parseWranglerWorkerList,
  type ParseResult,
} from "../tools/starter/cloudflare-wrangler-output";
import { runControlledCloudflareWorkflow } from "../tools/starter/cloudflare-workflows";
import type { BootstrapConfigInput } from "../tools/starter/production-bootstrap";
import type { WranglerCommandResult } from "../tools/starter/wrangler";

async function main() {
  testD1Parser();
  testR2Parser();
  testWorkerAndSecretUnsupported();
  await testRemoteStateAffectsPlanHash();
  await testUnknownOwnershipBlocksExecute();
  console.log("PASS wrangler read parser tests");
}

function testD1Parser() {
  const success = parseWranglerD1List(command({ stdout: '{"result":[{"uuid":"11111111-1111-4111-8111-111111111111","name":"site-db"}]}' }));
  assert.equal(success.ok, true);
  assert.equal(success.ok && success.value[0]?.id, "11111111-1111-4111-8111-111111111111");

  const empty = parseWranglerD1List(command({ stdout: "[]" }));
  assert.equal(empty.ok, true);
  assert.equal(empty.ok && empty.value.length, 0);

  const warningPlusJson = parseWranglerD1List(command({ stdout: 'Warning: noisy\n{"result":[{"id":"22222222-2222-4222-8222-222222222222","database_name":"other-db"}]}\n' }));
  assert.equal(warningPlusJson.ok, true);
  assert.equal(warningPlusJson.ok && warningPlusJson.value[0]?.name, "other-db");

  const missing = parseWranglerD1List(command({ stdout: '{"result":[{"name":"missing-id"}]}' }));
  assert.equal(missing.ok, false);
  assert.equal(!missing.ok && missing.code, "WRANGLER_D1_LIST_MISSING_FIELDS");

  const failure = parseWranglerD1List(command({ exitCode: 1, stderr: "permission denied" }));
  assert.equal(failure.ok, false);
  assert.equal(!failure.ok && failure.code, "WRANGLER_PERMISSION_DENIED");

  const notFound = parseWranglerSecretList(command({ exitCode: 1, stderr: 'Worker "missing" not found.' }));
  assert.equal(notFound.ok, false);
  assert.equal(!notFound.ok && notFound.code, "WRANGLER_NOT_FOUND");
}

function testR2Parser() {
  const json = parseWranglerR2BucketList(command({ stdout: '{"result":[{"name":"site-media","creation_date":"2026-08-06"}]}' }));
  assert.equal(json.ok, true);
  assert.equal(json.ok && json.value[0]?.name, "site-media");

  const text = parseWranglerR2BucketList(command({ stdout: "name: site-media\nname: other-media\n" }));
  assert.equal(text.ok, true);
  assert.equal(text.ok && text.value.length, 2);

  const emptyText = parseWranglerR2BucketList(command({ stdout: "No buckets found\n" }));
  assert.equal(emptyText.ok, true);
  assert.equal(emptyText.ok && emptyText.value.length, 0);

  const malformed = parseWranglerR2BucketList(command({ stdout: "deployment complete without bucket records" }));
  assert.equal(malformed.ok, false);
  assert.equal(!malformed.ok && malformed.code, "WRANGLER_R2_LIST_PARSE_FAILED");
}

function testWorkerAndSecretUnsupported() {
  const worker = parseWranglerWorkerList(command({ stdout: "worker list is not a stable command" }));
  assert.equal(worker.ok, false);
  assert.equal(!worker.ok && worker.code, "WRANGLER_WORKER_LIST_UNSUPPORTED");

  const secret = parseWranglerSecretList(command({ stdout: "pretty output without json" }));
  assert.equal(secret.ok, false);
  assert.equal(!secret.ok && secret.code, "WRANGLER_SECRET_LIST_UNSUPPORTED");

  const prompt = parseWranglerD1List(command({ stdout: "Would you like to log in?" }));
  assert.equal(prompt.ok, false);
  assert.equal(!prompt.ok && prompt.code, "WRANGLER_INTERACTIVE_PROMPT");
}

async function testRemoteStateAffectsPlanHash() {
  const options = parseRemoteExecutionArgs(["--remote-check", "--adapter=mock", "--account-id=acct"]);
  const first = await runControlledCloudflareWorkflow({ config: validConfig(), options, adapter: fixtureAdapter({ d1Id: "11111111-1111-4111-8111-111111111111" }) });
  const second = await runControlledCloudflareWorkflow({ config: validConfig(), options, adapter: fixtureAdapter({ d1Id: "22222222-2222-4222-8222-222222222222" }) });
  assert.notEqual(first.planHash, second.planHash);
}

async function testUnknownOwnershipBlocksExecute() {
  const snapshot = snapshotConfigFiles();
  try {
    const plan = await runControlledCloudflareWorkflow({
      config: validConfig(),
      options: parseRemoteExecutionArgs(["--remote-plan", "--adapter=mock", "--account-id=acct"]),
      adapter: fixtureAdapter({ workerUnsupported: true }),
    });
    const execute = await runControlledCloudflareWorkflow({
      config: validConfig(),
      options: parseRemoteExecutionArgs([
        "--execute",
        "--adapter=mock",
        "--account-id=acct",
        `--approved-plan-hash=${plan.planHash}`,
        "--allow-create-worker",
        "--allow-create-d1",
        "--allow-create-r2",
        "--allow-config-patch",
        "--allow-set-secrets",
        "--allow-deploy",
        "--allow-d1-write",
        "--allow-bootstrap-seed",
        "--allow-r2-probe",
      ]),
      adapter: fixtureAdapter({ workerUnsupported: true }),
    });
    assert.equal(execute.summary, "failed");
    assert(execute.remoteCalls.includes("listWorkers"));
    assert(execute.checks.some((check) => /ownership|inaccessible|unsupported/i.test(check.detail)));
  } finally {
    restoreConfigFiles(snapshot);
  }
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

function ok<T>(resource: T) {
  return { ok: true, status: "pass" as const, resource, rawSummary: "fixture", warnings: [], retryable: false };
}

function failure(code: string) {
  return { ok: false, status: "unsupported" as const, rawSummary: code, warnings: [], errorCode: code, errorMessage: code, retryable: false };
}

function fixtureAdapter(input: { d1Id?: string; workerUnsupported?: boolean }): ControlledCloudflareAdapter {
  const callLog: string[] = [];
  return {
    mode: "mock",
    callLog,
    async getWranglerVersion() {
      callLog.push("getWranglerVersion");
      return ok("mock-wrangler");
    },
    async getAuthStatus() {
      callLog.push("getAuthStatus");
      return ok({ authenticated: true, accounts: [{ id: "acct", name: "Fixture" }], status: "authenticated" as const, detail: "fixture" });
    },
    async getPermissions() {
      callLog.push("getPermissions");
      return ok([]);
    },
    async listWorkers() {
      callLog.push("listWorkers");
      return input.workerUnsupported ? failure("WRANGLER_WORKER_LIST_UNSUPPORTED") : ok([{ name: "contentforge-it-phase-one-worker", accountId: "acct" }]);
    },
    async listD1Databases() {
      callLog.push("listD1Databases");
      return ok([{ name: "contentforge-it-phase-one-db", id: input.d1Id ?? "11111111-1111-4111-8111-111111111111", accountId: "acct" }]);
    },
    async listR2Buckets() {
      callLog.push("listR2Buckets");
      return ok([{ name: "contentforge-it-phase-one-media", accountId: "acct" }]);
    },
    async listWorkerSecrets() {
      callLog.push("listWorkerSecrets");
      return ok([{ name: "ADMIN_PASSWORD" as const, status: "configured" as const }]);
    },
    async putWorkerSecret() {
      throw new Error("write should not run");
    },
    async deployWorker() {
      throw new Error("write should not run");
    },
    async createD1Database() {
      throw new Error("write should not run");
    },
    async executeD1() {
      throw new Error("write should not run");
    },
    async createR2Bucket() {
      throw new Error("write should not run");
    },
    async putR2Object() {
      throw new Error("write should not run");
    },
    async getR2Object() {
      throw new Error("write should not run");
    },
    async deleteR2Object() {
      throw new Error("write should not run");
    },
  };
}

function validConfig(): BootstrapConfigInput {
  return {
    siteName: "Phase One",
    siteSlug: "phase-one",
    siteUrl: "https://phase-one.example",
    canonicalHost: "phase-one.example",
    workerName: "contentforge-it-phase-one-worker",
    d1DatabaseName: "contentforge-it-phase-one-db",
    d1DatabaseId: "11111111-1111-4111-8111-111111111111",
    r2BucketName: "contentforge-it-phase-one-media",
    r2PublicBaseUrl: "https://phase-one.example/media",
    customDomain: "phase-one.example",
    wwwRedirect: true,
    cloudflareAccountId: "acct",
    productionFallback: false,
    deploymentEnvironment: "production",
  };
}

function snapshotConfigFiles() {
  const files = ["wrangler.jsonc", "starter.site.json"];
  return files.map((file) => {
    const absolutePath = path.join(process.cwd(), file);
    return { absolutePath, content: readFileSync(absolutePath, "utf8") };
  });
}

function restoreConfigFiles(snapshot: Array<{ absolutePath: string; content: string }>) {
  for (const file of snapshot) {
    writeFileSync(file.absolutePath, file.content, "utf8");
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
