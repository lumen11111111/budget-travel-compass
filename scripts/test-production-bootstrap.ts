import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import path from "node:path";

import {
  buildManifest,
  buildResourcePlan,
  manifestRelativePath,
  parseBootstrapArgs,
  printProductionDoctor,
  reportRelativePath,
  resolveBootstrapConfig,
  runProductionBootstrapCli,
  type BootstrapConfigInput,
  type BootstrapOptions,
  type CloudflareAdapter,
  type ResourceCreationMode,
  type ResourcePlan,
} from "../tools/starter/production-bootstrap";

type FixtureAdapterInput = {
  mode?: ResourceCreationMode;
  workers?: Array<{ name: string }>;
  d1?: Array<{ name: string; id: string }>;
  r2?: Array<{ name: string }>;
  secrets?: Array<{ name: string; status: "configured" | "missing" | "unknown" }>;
  authenticated?: boolean;
};

const placeholderUuid = "00000000-0000-0000-0000-000000000000";

async function main() {
  testConfigResolutionPriority();
  testInvalidResourceNamesWarn();
  await testNewResourcePlan();
  await testExistingResourcePlan();
  await testAmbiguousResourcePlan();
  await testD1IdReuse();
  testManifestWarningsAndManualActions();
  await testDryRunDoesNotWrite();
  await testNoSecretValueOutput();
  await testNonInteractiveRequiresConfirmation();
  await testDoctorArticlesZeroAccepted();
  await testDoctorWwwManualAction();
  await testIdempotentManifest();
  testStatusPaths();
  testInvalidStepRejected();
  testProductionResourceAuthorizationFlag();

  console.log("PASS production bootstrap tests");
}

function testConfigResolutionPriority() {
  const { config } = resolveBootstrapConfig({
    siteName: "Override Site",
    siteUrl: "https://override.example",
    canonicalHost: "override.example",
    workerName: "override-worker",
    d1DatabaseName: "override-db",
    r2BucketName: "override-media",
  });

  assert.equal(config.siteName, "Override Site");
  assert.equal(config.siteUrl, "https://override.example");
  assert.equal(config.canonicalHost, "override.example");
  assert.equal(config.workerName, "override-worker");
  assert.equal(config.d1DatabaseName, "override-db");
  assert.equal(config.r2BucketName, "override-media");
}

function testInvalidResourceNamesWarn() {
  const { warnings } = resolveBootstrapConfig({
    siteUrl: "https://example.com",
    workerName: "Bad Worker Name",
    d1DatabaseId: placeholderUuid,
    productionFallback: true,
  });

  assert(warnings.some((warning) => warning.includes("example.com")));
  assert(warnings.some((warning) => warning.includes("Worker name")));
  assert(warnings.some((warning) => warning.includes("placeholder")));
  assert(warnings.some((warning) => warning.includes("Production fallback")));
}

async function testNewResourcePlan() {
  const plan = await buildResourcePlan(validConfig(), fixtureAdapter());

  assert.equal(plan.worker.state, "new");
  assert.equal(plan.worker.action, "create");
  assert.equal(plan.d1.state, "new");
  assert.equal(plan.r2.state, "new");
  assert.equal(plan.domain.action, "manual-action-required");
  assert(plan.secrets.every((secret) => secret.status === "unknown"));
}

async function testExistingResourcePlan() {
  const config = validConfig();
  const plan = await buildResourcePlan(
    config,
    fixtureAdapter({
      workers: [{ name: config.workerName }],
      d1: [{ name: config.d1DatabaseName, id: "22222222-2222-2222-2222-222222222222" }],
      r2: [{ name: config.r2BucketName }],
      secrets: [
        { name: "ADMIN_PASSWORD", status: "configured" },
        { name: "SESSION_SECRET", status: "configured" },
      ],
      authenticated: true,
    }),
  );

  assert.equal(plan.worker.action, "reuse");
  assert.equal(plan.d1.action, "reuse");
  assert.equal(plan.r2.action, "reuse");
  assert(plan.secrets.every((secret) => secret.status === "configured"));
}

async function testAmbiguousResourcePlan() {
  const config = validConfig();
  const plan = await buildResourcePlan(
    config,
    fixtureAdapter({
      workers: [{ name: config.workerName }, { name: config.workerName }],
      d1: [
        { name: config.d1DatabaseName, id: "33333333-3333-3333-3333-333333333333" },
        { name: config.d1DatabaseName, id: "44444444-4444-4444-4444-444444444444" },
      ],
      r2: [{ name: config.r2BucketName }, { name: config.r2BucketName }],
    }),
  );

  assert.equal(plan.worker.state, "ambiguous");
  assert.equal(plan.d1.state, "ambiguous");
  assert.equal(plan.r2.state, "ambiguous");
}

async function testD1IdReuse() {
  const config = { ...validConfig(), d1DatabaseId: "55555555-5555-5555-5555-555555555555" };
  const plan = await buildResourcePlan(
    config,
    fixtureAdapter({
      d1: [{ name: "renamed-db", id: config.d1DatabaseId }],
    }),
  );

  assert.equal(plan.d1.action, "reuse");
  assert.equal(plan.d1.databaseId, config.d1DatabaseId);
}

function testManifestWarningsAndManualActions() {
  const config = validConfig();
  const resourcePlan = minimalPlan();
  const manifest = buildManifest(config, resourcePlan, options(), ["example.com is not production-safe."]);
  const seo = manifest.steps.find((step) => step.id === "seo-validation");

  assert.equal(manifest.completed, false);
  assert.equal(seo?.status, "blocked");
  assert(manifest.manualActions.some((action) => action.includes("Worker")));
  assert(!JSON.stringify(manifest).includes("super-secret-value"));
}

async function testDryRunDoesNotWrite() {
  const beforeManifest = existsSync(path.join(process.cwd(), manifestRelativePath));
  const beforeReport = existsSync(path.join(process.cwd(), reportRelativePath));
  const output = await captureConsole(() => runProductionBootstrapCli(["--dry-run", "--site-url=https://bootstrap-test.example"]));

  assert(output.includes("Dry Run"));
  assert.equal(existsSync(path.join(process.cwd(), manifestRelativePath)), beforeManifest);
  assert.equal(existsSync(path.join(process.cwd(), reportRelativePath)), beforeReport);
}

async function testNoSecretValueOutput() {
  process.env.ADMIN_PASSWORD = "super-secret-value";
  process.env.SESSION_SECRET = "another-secret-value";
  try {
    const output = await captureConsole(() => runProductionBootstrapCli(["--plan", "--site-url=https://bootstrap-test.example"]));
    assert(!output.includes("super-secret-value"));
    assert(!output.includes("another-secret-value"));
    assert(output.includes("ADMIN_PASSWORD"));
  } finally {
    delete process.env.ADMIN_PASSWORD;
    delete process.env.SESSION_SECRET;
  }
}

async function testNonInteractiveRequiresConfirmation() {
  await assert.rejects(
    () => runProductionBootstrapCli(["--non-interactive", "--allow-local-write", "--site-url=https://bootstrap-test.example"]),
    /requires --yes/,
  );
}

async function testDoctorArticlesZeroAccepted() {
  const output = await captureConsole(() => printProductionDoctor(options(), fixtureAdapter()));

  assert(output.includes("articles=0 is accepted"));
}

async function testDoctorWwwManualAction() {
  const output = await captureConsole(() =>
    runProductionBootstrapCli(["--doctor", "--site-url=https://bootstrap-test.example", "--custom-domain=bootstrap-test.example"]),
  );

  assert(output.includes("custom domain"));
  assert(output.includes("www"));
}

async function testIdempotentManifest() {
  const config = validConfig();
  const plan = minimalPlan();
  const first = buildManifest(config, plan, options(), []);
  const second = buildManifest(config, plan, options(), []);

  assert.equal(first.workerName, second.workerName);
  assert.equal(first.d1DatabaseName, second.d1DatabaseName);
  assert.equal(first.r2BucketName, second.r2BucketName);
  assert.deepEqual(first.steps.map((step) => [step.id, step.status]), second.steps.map((step) => [step.id, step.status]));
}

function testStatusPaths() {
  assert.equal(manifestRelativePath, path.join(".contentforge", "production-bootstrap.json"));
  assert.equal(reportRelativePath, path.join(".contentforge", "production-bootstrap-report.md"));
}

function testInvalidStepRejected() {
  assert.throws(() => parseBootstrapArgs(["--step=not-a-step"]), /Invalid bootstrap step/);
}

function testProductionResourceAuthorizationFlag() {
  assert.equal(parseBootstrapArgs(["--allow-production-resources"]).allowProductionResources, true);
  assert.equal(parseBootstrapArgs(["--yes"]).allowProductionResources, false);
}

function validConfig(): BootstrapConfigInput {
  return {
    siteName: "Bootstrap Test",
    siteSlug: "bootstrap-test",
    siteUrl: "https://bootstrap-test.example",
    canonicalHost: "bootstrap-test.example",
    workerName: "bootstrap-test",
    d1DatabaseName: "bootstrap-test-db",
    d1DatabaseId: placeholderUuid,
    r2BucketName: "bootstrap-test-media",
    r2PublicBaseUrl: "https://bootstrap-test.example/media",
    customDomain: "bootstrap-test.example",
    wwwRedirect: true,
    cloudflareAccountId: "",
    productionFallback: false,
    deploymentEnvironment: "production",
  };
}

function options(): BootstrapOptions {
  return {
    dryRun: true,
    plan: false,
    resume: false,
    status: false,
    doctor: false,
    nonInteractive: false,
    yes: false,
    allowCreate: false,
    allowDeploy: false,
    allowDomainChange: false,
    allowLocalWrite: false,
    writeManifest: false,
    adapterMode: "offline",
    remote: false,
    remotePlan: false,
    remoteCheck: false,
    execute: false,
    recoverConfigPatch: false,
    rollbackConfigPatch: false,
    accountId: "",
    allowCreateWorker: false,
    allowCreateD1: false,
    allowCreateR2: false,
    allowSetSecrets: false,
    allowD1Write: false,
    allowR2Probe: false,
    allowConfigPatch: false,
    allowBootstrapSeed: false,
    allowCleanup: false,
    allowProductionResources: false,
    allowDnsChange: false,
    overrides: {},
  };
}

function minimalPlan(): ResourcePlan {
  return {
    worker: { proposedName: "bootstrap-test", state: "new", action: "create", reason: "Worker does not exist." },
    d1: {
      proposedName: "bootstrap-test-db",
      state: "new",
      action: "create",
      reason: "D1 database does not exist.",
      databaseId: undefined,
    },
    r2: { proposedName: "bootstrap-test-media", state: "new", action: "create", reason: "R2 bucket does not exist." },
    domain: {
      apex: "bootstrap-test.example",
      www: "www.bootstrap-test.example",
      canonical: "bootstrap-test.example",
      currentDnsState: "not-checked",
      desiredRedirect: "www -> apex permanent redirect",
      action: "manual-action-required",
    },
    secrets: [
      { name: "ADMIN_PASSWORD", purpose: "Admin CMS login password.", status: "unknown", command: "npx wrangler secret put ADMIN_PASSWORD" },
      { name: "SESSION_SECRET", purpose: "Signed admin session secret.", status: "unknown", command: "npx wrangler secret put SESSION_SECRET" },
    ],
  };
}

function fixtureAdapter(input: FixtureAdapterInput = {}): CloudflareAdapter {
  return {
    mode: input.mode ?? "offline",
    async getAuthStatus() {
      return {
        authenticated: input.authenticated ?? false,
        status: input.authenticated ? "authenticated" : "unknown",
        detail: input.authenticated ? "Fixture account." : "Fixture does not contact Cloudflare.",
      };
    },
    async listWorkers() {
      return input.workers ?? [];
    },
    async listD1Databases() {
      return input.d1 ?? [];
    },
    async listR2Buckets() {
      return input.r2 ?? [];
    },
    async getSecretsStatus(names: string[]) {
      return names.map((name) => input.secrets?.find((secret) => secret.name === name) ?? { name, status: "unknown" as const });
    },
  };
}

async function captureConsole(callback: () => Promise<void>) {
  const originalLog = console.log;
  const originalError = console.error;
  const chunks: string[] = [];

  console.log = (...args: unknown[]) => {
    chunks.push(args.join(" "));
  };
  console.error = (...args: unknown[]) => {
    chunks.push(args.join(" "));
  };

  try {
    await callback();
  } finally {
    console.log = originalLog;
    console.error = originalError;
  }

  return chunks.join("\n");
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
