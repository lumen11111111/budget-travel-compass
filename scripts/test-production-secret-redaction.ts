import assert from "node:assert/strict";

import { createControlledAdapter, sanitizeOutput } from "../tools/starter/cloudflare-adapter";
import { parseRemoteExecutionArgs } from "../tools/starter/cloudflare-execution";
import { preflightSecrets } from "../tools/starter/production-phase4";

async function main() {
  testSecretAllowAlias();
  testSecretPreflight();
  await testSecretStdinOnlyAndNoLeak();
  console.log("PASS production secret redaction tests");
}

function testSecretAllowAlias() {
  assert.equal(parseRemoteExecutionArgs(["--allow-secret-write"]).allowFlags.allowSetSecrets, true);
  assert.equal(parseRemoteExecutionArgs(["--yes"]).allowFlags.allowSetSecrets, false);
}

function testSecretPreflight() {
  assert.equal(preflightSecrets({}).code, "ADMIN_PASSWORD_MISSING");
  assert.equal(preflightSecrets({ CONTENTFORGE_ADMIN_PASSWORD: "example-password-123456" }).code, "ADMIN_PASSWORD_PLACEHOLDER");
  assert.equal(preflightSecrets({ CONTENTFORGE_ADMIN_PASSWORD: "short" }).code, "ADMIN_PASSWORD_TOO_WEAK");
  assert.equal(preflightSecrets({ CONTENTFORGE_ADMIN_PASSWORD: "strong-production-passphrase", CONTENTFORGE_SESSION_SECRET: "too-short" }).code, "SESSION_SECRET_INVALID");
  assert.equal(preflightSecrets({ CONTENTFORGE_ADMIN_PASSWORD: "strong-production-passphrase", CONTENTFORGE_SESSION_SECRET: "01234567890123456789012345678901" }).ok, true);
}

async function testSecretStdinOnlyAndNoLeak() {
  const secret = "strong-production-passphrase";
  const adapter = createControlledAdapter("mock");
  const result = await adapter.putWorkerSecret("acct", "worker", "ADMIN_PASSWORD", secret);
  assert.equal(result.ok, true);
  assert(adapter.callLog.includes("putWorkerSecret:ADMIN_PASSWORD:stdin"));
  assert(!adapter.callLog.join("\n").includes(secret));
  assert(!JSON.stringify(result).includes(secret));
  assert.equal(sanitizeOutput(`CONTENTFORGE_ADMIN_PASSWORD=${secret}`), "CONTENTFORGE_ADMIN_PASSWORD=***");
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
