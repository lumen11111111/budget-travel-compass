import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { createControlledAdapter } from "../tools/starter/cloudflare-adapter";
import { parseRemoteExecutionArgs, type RemoteExecutionOptions } from "../tools/starter/cloudflare-execution";
import { runControlledCloudflareWorkflow, type ControlledWorkflowReport } from "../tools/starter/cloudflare-workflows";
import { rollbackProductionConfig } from "../tools/starter/production-config-patch";
import { sha256 } from "../tools/starter/production-patches";
import { runWranglerCommand } from "../tools/starter/wrangler";
import type { BootstrapConfigInput } from "../tools/starter/production-bootstrap";

type CleanupStep = {
  step: string;
  status: "success" | "failed" | "blocked";
  detail: string;
  startedAt: string;
  completedAt: string;
};

const root = process.cwd();
const accountId = process.env.CLOUDFLARE_ACCOUNT_ID || "5a2aabbbd4edcda1fd562a657a270dc7";
const runId = Date.now().toString(36).toLowerCase();
const prefix = `contentforge-it-c${runId}`;
const names = {
  worker: `${prefix}-worker`,
  d1: `${prefix}-d1`,
  r2: `${prefix}-media`,
};
const operationId = `cert-${sha256(prefix).slice(0, 16)}`;
const reportDir = path.join(root, ".contentforge", "certification", operationId);
const certificationMd = path.join(root, "CONTENTFORGE_V1_CERTIFICATION.md");
const releaseCertificationMd = path.join(root, "docs", "releases", "CONTENTFORGE_V1_CERTIFICATION.md");
const cleanupSteps: CleanupStep[] = [];

async function main() {
  mkdirSync(reportDir, { recursive: true });
  requireCertificationGates();
  ensureGeneratedSecrets();

  const config = certificationConfig();
  const planOptions = remoteOptions(["--remote-plan"]);
  const plan = await runControlledCloudflareWorkflow({ config, options: planOptions, adapter: createControlledAdapter("wrangler") });

  const executeOptions = remoteOptions([
    "--execute",
    `--approved-plan-hash=${plan.planHash}`,
    "--allow-create-d1",
    "--allow-create-r2",
    "--allow-config-patch",
    "--allow-deploy",
    "--allow-set-secrets",
    "--allow-d1-write",
    "--allow-bootstrap-seed",
    "--allow-r2-probe",
  ]);
  const execute = await runControlledCloudflareWorkflow({ config, options: executeOptions, adapter: createControlledAdapter("wrangler") });
  const productionReport = readProductionReport();

  await cleanup({ productionReport });
  const absence = await verifyAbsence();
  writeCertification({ plan, execute, productionReport, absence });

  const certified = execute.summary === "passed" && cleanupSteps.every((step) => step.status === "success") && absence.every((item) => item.ok);
  process.exitCode = certified ? 0 : 1;
}

function remoteOptions(args: string[]): RemoteExecutionOptions {
  const options = parseRemoteExecutionArgs(["--adapter=wrangler", `--account-id=${accountId}`, ...args]);
  options.accountId = accountId;
  return options;
}

function certificationConfig(): BootstrapConfigInput {
  return {
    siteName: "ContentForge Integration Certification",
    siteSlug: prefix,
    siteUrl: `https://${names.worker}.workers.dev`,
    canonicalHost: `${names.worker}.workers.dev`,
    workerName: names.worker,
    d1DatabaseName: names.d1,
    d1DatabaseId: "00000000-0000-0000-0000-000000000000",
    r2BucketName: names.r2,
    r2PublicBaseUrl: `https://${names.worker}.workers.dev/media`,
    customDomain: "",
    wwwRedirect: false,
    cloudflareAccountId: accountId,
    productionFallback: false,
    deploymentEnvironment: "production",
  };
}

async function cleanup(input: { productionReport: Record<string, unknown> }) {
  await cleanupStep("delete-worker", async () => {
    assertCleanupAllowed(input.productionReport, names.worker);
    const result = await runWranglerCommand({ args: ["delete", names.worker, "--force"], accountId, timeoutMs: 120_000 });
    if (!result.ok && !isAbsent(`${result.stdout}\n${result.stderr}`)) throw new Error(result.stderr || result.stdout || result.errorCode);
    return "worker deleted or absent";
  });
  await cleanupStep("delete-d1", async () => {
    assertCleanupAllowed(input.productionReport, names.d1);
    const result = await runWranglerCommand({ args: ["d1", "delete", names.d1, "--skip-confirmation"], accountId, timeoutMs: 120_000 });
    if (!result.ok && !isAbsent(`${result.stdout}\n${result.stderr}`)) throw new Error(result.stderr || result.stdout || result.errorCode);
    return "d1 deleted or absent";
  });
  await cleanupStep("delete-r2", async () => {
    assertCleanupAllowed(input.productionReport, names.r2);
    const result = await runWranglerCommand({ args: ["r2", "bucket", "delete", names.r2], accountId, timeoutMs: 120_000, stdin: "y\n" });
    if (!result.ok && !isAbsent(`${result.stdout}\n${result.stderr}`)) throw new Error(result.stderr || result.stdout || result.errorCode);
    return "r2 deleted or absent";
  });
  await cleanupStep("rollback-config", async () => {
    const patchOperationId = typeof input.productionReport.patchOperationId === "string" ? input.productionReport.patchOperationId : "";
    if (!patchOperationId) return "no config patch was recorded";
    const result = rollbackProductionConfig({ operationId: patchOperationId });
    if (!result.ok) throw new Error(`${result.errorCode}: ${result.message}`);
    return "local config rolled back";
  });
}

async function verifyAbsence() {
  const d1 = await runWranglerCommand({ args: ["d1", "list", "--json"], accountId, timeoutMs: 120_000 });
  const r2 = await runWranglerCommand({ args: ["r2", "bucket", "list"], accountId, timeoutMs: 120_000 });
  const worker = await runWranglerCommand({ args: ["deployments", "list", "--name", names.worker], accountId, timeoutMs: 120_000 });
  return [
    { resource: "d1", ok: d1.ok && !d1.stdout.includes(names.d1), detail: d1.ok ? "no matching D1" : d1.stderr || d1.errorCode || "d1 list failed" },
    { resource: "r2", ok: r2.ok && !r2.stdout.includes(names.r2), detail: r2.ok ? "no matching R2" : r2.stderr || r2.errorCode || "r2 list failed" },
    { resource: "worker", ok: !worker.ok && isAbsent(`${worker.stdout}\n${worker.stderr}`), detail: worker.ok ? "worker still exists" : "worker absent" },
  ];
}

function assertCleanupAllowed(report: Record<string, unknown>, resourceName: string) {
  if (process.env.CONTENTFORGE_ENABLE_REAL_CLOUDFLARE_CLEANUP !== "1") throw new Error("Cleanup env gate is not enabled.");
  if (!resourceName.startsWith("contentforge-it-")) throw new Error("Cleanup is limited to contentforge-it-* resources.");
  if (/groupgamehub/i.test(resourceName)) throw new Error("Group Game Hub cleanup target is forbidden.");
  if (report.account !== accountId) throw new Error("Cleanup account mismatch.");
  if (report.adapter !== "wrangler") throw new Error("Cleanup requires wrangler adapter evidence.");
  const resourcesText = JSON.stringify(report.resources ?? []);
  if (!resourcesText.includes(resourceName)) throw new Error(`Cleanup target was not recorded in the production report: ${resourceName}`);
}

async function cleanupStep(step: string, fn: () => Promise<string> | string) {
  const startedAt = new Date().toISOString();
  try {
    const detail = await fn();
    cleanupSteps.push({ step, status: "success", detail, startedAt, completedAt: new Date().toISOString() });
  } catch (error) {
    cleanupSteps.push({ step, status: "failed", detail: safeError(error), startedAt, completedAt: new Date().toISOString() });
  }
}

function requireCertificationGates() {
  if (process.argv.includes("--allow-production-resources")) throw new Error("PRODUCTION_RESOURCE_CERTIFICATION_FORBIDDEN: production:certify must not request production resource authorization.");
  for (const gate of [
    "CONTENTFORGE_ENABLE_REAL_CLOUDFLARE_WRITES",
    "CONTENTFORGE_ENABLE_REAL_WORKER_DEPLOY",
    "CONTENTFORGE_ENABLE_REAL_SECRET_WRITES",
    "CONTENTFORGE_ENABLE_REAL_D1_WRITES",
    "CONTENTFORGE_ENABLE_REAL_R2_WRITES",
    "CONTENTFORGE_ENABLE_REAL_CLOUDFLARE_CLEANUP",
  ]) {
    if (process.env[gate] !== "1") throw new Error(`${gate} must be set to 1 for certification.`);
  }
  if (!prefix.startsWith("contentforge-it-")) throw new Error("Certification prefix must start with contentforge-it-.");
  if (/groupgamehub/i.test(JSON.stringify(names))) throw new Error("Group Game Hub names are forbidden.");
}

function ensureGeneratedSecrets() {
  process.env.CONTENTFORGE_ADMIN_PASSWORD ||= `cert-admin-${sha256(prefix).slice(0, 24)}A!`;
  process.env.CONTENTFORGE_SESSION_SECRET ||= sha256(`${prefix}:session`);
}

function readProductionReport() {
  const reportPath = path.join(root, ".contentforge", "production-execution-report.json");
  return existsSync(reportPath) ? JSON.parse(readFileSync(reportPath, "utf8")) as Record<string, unknown> : {};
}

function writeCertification(input: {
  plan: ControlledWorkflowReport;
  execute: ControlledWorkflowReport;
  productionReport: Record<string, unknown>;
  absence: Array<{ resource: string; ok: boolean; detail: string }>;
}) {
  const verdict = input.execute.summary === "passed" && cleanupSteps.every((step) => step.status === "success") && input.absence.every((item) => item.ok) ? "certified-clean" : "failed-or-cleanup-required";
  const reportJson = path.join(reportDir, "production-execution-report.json");
  const reportMd = path.join(reportDir, "production-execution-report.md");
  writeFileSync(reportJson, `${JSON.stringify(input.productionReport, null, 2)}\n`, "utf8");
  writeFileSync(reportMd, renderProductionReportMarkdown(input.productionReport), "utf8");

  const lines = [
    "# ContentForge V1 Certification",
    "",
    `Date: ${new Date().toISOString()}`,
    `Operation ID: ${operationId}`,
    `Formal plan hash: ${input.plan.planHash}`,
    `Production verdict: ${String(input.productionReport.verdict ?? "")}`,
    `Certification verdict: ${verdict}`,
    `Cloudflare account: ${accountId}`,
    `Temporary prefix: ${prefix}`,
    "",
    "## Certified Formal CLI Flow",
    "Remote Plan -> Approved Plan Hash -> Execute -> Create -> Patch -> Build -> Deploy -> Secrets -> Schema -> Seed -> Verify -> R2 Probe -> Cleanup",
    "",
    "## Evidence",
    `Formal report JSON: ${path.relative(root, reportJson)}`,
    `Formal report Markdown: ${path.relative(root, reportMd)}`,
    "",
    "## Cleanup",
    ...cleanupSteps.map((step) => `- ${step.status} ${step.step}: ${step.detail}`),
    "",
    "## Remote Absence",
    ...input.absence.map((item) => `- ${item.ok ? "success" : "failed"} ${item.resource}: ${item.detail}`),
    "",
    "No Group Game Hub resources were used. Secret values are not recorded.",
    "",
  ];
  writeFileSync(certificationMd, lines.join("\n"), "utf8");
  mkdirSync(path.dirname(releaseCertificationMd), { recursive: true });
  writeFileSync(releaseCertificationMd, lines.join("\n"), "utf8");
}

function renderProductionReportMarkdown(report: Record<string, unknown>) {
  const steps = Array.isArray(report.actualResults) ? report.actualResults as Array<Record<string, unknown>> : [];
  return [
    "# Production Execution Report",
    "",
    `Generated: ${String(report.generatedAt ?? "")}`,
    `Account: ${String(report.account ?? "")}`,
    `Adapter: ${String(report.adapter ?? "")}`,
    `Plan hash: ${String(report.planHash ?? "")}`,
    `Verdict: ${String(report.verdict ?? "")}`,
    "",
    "## Actual Results",
    ...steps.map((step) => `- ${String(step.outcome)} ${String(step.stepId)}: ${String(step.evidence ?? "")}`),
    "",
  ].join("\n");
}

function isAbsent(output: string) {
  return /not found|does not exist|couldn't find|specified bucket does not exist|This Worker does not exist/i.test(output);
}

function safeError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return message
    .replace(/(Bearer\s+)[A-Za-z0-9._-]+/g, "$1***")
    .replace(/(Authorization:\s*)[^\r\n]+/gi, "$1***")
    .replace(/(CONTENTFORGE_ADMIN_PASSWORD\s*=\s*)[^\s]+/g, "$1***")
    .slice(0, 500);
}

main().catch((error) => {
  console.error(safeError(error));
  process.exitCode = 1;
});
