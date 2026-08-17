import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { siteConfig } from "../../src/config/site.config";
import { projectRoot, readJsoncFile, runCommand, truncate } from "./cli-utils";
import { runWrangler } from "./wrangler";

type Status = "PASS" | "WARN" | "FAIL";

type Check = {
  status: Status;
  label: string;
  detail: string;
  action?: string;
};

type Options = {
  checkOnly: boolean;
  yes: boolean;
};

type PackageJson = {
  name?: string;
};

type WranglerConfig = {
  name?: string;
  assets?: {
    run_worker_first?: boolean;
  };
  d1_databases?: Array<{
    binding?: string;
    database_id?: string;
  }>;
  r2_buckets?: Array<{
    binding?: string;
  }>;
  vars?: Record<string, string>;
};

const placeholderUuid = "00000000-0000-0000-0000-000000000000";
const defaultValues = new Set(["contentforge-starter", "starter-default", "legacy-default", "https://example.com"]);

async function main() {
  const options = parseArgs(process.argv.slice(2));

  console.log(options.checkOnly ? "Starter Preflight" : "Starter Publish Pipeline");
  console.log("");

  const staticChecks = await runStaticChecks();
  printChecks(staticChecks);
  if (hasFail(staticChecks)) stop("Local configuration checks failed.");

  await runStep("STEP 1", "Run doctor", "doctor");
  await runStep("STEP 2", "Run typecheck", "typecheck");
  await runStep("STEP 3", "Run lint", "lint");
  await runStep("STEP 4", "Run build", "build");
  await runStep("STEP 5", "Run deploy:build", "deploy:build");

  const workerChecks = verifyWorkerOutput();
  printChecks(workerChecks);
  if (hasFail(workerChecks)) stop("OpenNext worker output is missing.");

  console.log("");
  pass("Ready to deploy", "Preflight passed.");
  console.log("");
  console.log("Deploy command:");
  console.log("npx wrangler deploy");

  if (options.checkOnly) {
    printSummary([...staticChecks, ...workerChecks]);
    return;
  }

  if (options.yes) {
    await executeDeploy();
    printSummary([...staticChecks, ...workerChecks]);
    return;
  }

  const confirmed = await confirmDeploy();
  if (!confirmed) {
    printSummary([...staticChecks, ...workerChecks]);
    return;
  }

  await executeDeploy();
  printSummary([...staticChecks, ...workerChecks]);
}

function parseArgs(args: string[]): Options {
  const options = {
    checkOnly: false,
    yes: false,
  };

  for (const arg of args) {
    if (arg === "--check") {
      options.checkOnly = true;
    } else if (arg === "--yes") {
      options.yes = true;
    } else if (arg === "--help") {
      printHelp();
      process.exit(0);
    } else {
      fail("Argument", `Unknown argument: ${arg}`);
      process.exit(1);
    }
  }

  return options;
}

function printHelp() {
  console.log("Usage:");
  console.log("  npm run preflight");
  console.log("  npm run publish");
  console.log("  npm run publish -- --yes");
}

async function runStaticChecks(): Promise<Check[]> {
  const packageJson = readJson<PackageJson>("package.json");
  const wranglerConfig = readWranglerConfig();
  const gitRemote = await commandText("git", ["remote", "get-url", "origin"]);
  const gitStatus = await commandText("git", ["status", "--porcelain"]);
  const gitignoreLines = readGitignore();

  const d1 = wranglerConfig?.d1_databases?.[0];
  const r2 = wranglerConfig?.r2_buckets?.[0];

  return [
    required("wrangler.jsonc valid", wranglerConfig ? "Loaded." : null, "Fix wrangler.jsonc JSONC syntax."),
    required("package name", packageJson?.name, "Set package.json name."),
    defaultWarn("package name placeholder", packageJson?.name, "Change package.json name for the copied site."),
    required("site name", siteConfig.name, "Set siteConfig.name."),
    defaultWarn("site name placeholder", siteConfig.name, "Change siteConfig.name for the copied site."),
    required("domain", siteConfig.domain, "Set siteConfig.domain."),
    defaultWarn("domain placeholder", siteConfig.domain, "Change siteConfig.domain for the copied site."),
    defaultWarn("site url placeholder", siteConfig.url, "Change siteConfig.url for the copied site."),
    {
      status: d1?.binding === "DB" ? "PASS" : "FAIL",
      label: "D1 binding == DB",
      detail: d1?.binding ? `Found ${d1.binding}` : "Missing D1 binding.",
      action: "Keep the D1 binding named DB.",
    },
    {
      status: r2?.binding === "MEDIA_BUCKET" ? "PASS" : "FAIL",
      label: "R2 binding == MEDIA_BUCKET",
      detail: r2?.binding ? `Found ${r2.binding}` : "Missing R2 binding.",
      action: "Keep the R2 binding named MEDIA_BUCKET.",
    },
    {
      status: wranglerConfig?.assets?.run_worker_first === true ? "PASS" : "FAIL",
      label: "run_worker_first == true",
      detail: wranglerConfig?.assets?.run_worker_first === true ? "true" : "Not true.",
      action: "Set assets.run_worker_first to true.",
    },
    {
      status: d1?.database_id && d1.database_id !== placeholderUuid ? "PASS" : "FAIL",
      label: "D1 database_id",
      detail: d1?.database_id || "Missing database_id.",
      action: "Set a real D1 database_id.",
    },
    gitRemoteCheck(gitRemote),
    {
      status: gitStatus === "" ? "PASS" : "FAIL",
      label: "git working tree clean",
      detail: gitStatus === "" ? "Clean." : "Uncommitted changes exist.",
      action: "Commit or intentionally stash changes before publishing.",
    },
    ignoreCheck(gitignoreLines, "articles/"),
    ignoreCheck(gitignoreLines, ".env"),
  ];
}

function readWranglerConfig() {
  try {
    return readJsoncFile<WranglerConfig>(path.join(projectRoot, "wrangler.jsonc"));
  } catch {
    return null;
  }
}

async function runStep(step: string, label: string, scriptName: string) {
  console.log("");
  console.log(`${step}: ${label}`);
  const result = await runNpmScript(scriptName);
  if (result.code !== 0 || (scriptName === "doctor" && result.stdout.includes("✗ FAIL"))) {
    fail(label, truncate(result.stderr || result.stdout || `${scriptName} failed.`));
    stop(`${label} failed.`);
  }

  pass(label, `${scriptName} completed.`);
}

async function runNpmScript(scriptName: string) {
  const npmExecPath = process.env.npm_execpath;
  if (npmExecPath && existsSync(npmExecPath)) {
    return runCommand(process.execPath, [npmExecPath, "run", scriptName]);
  }

  const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
  return runCommand(npmCommand, ["run", scriptName]);
}

function verifyWorkerOutput(): Check[] {
  const workerPath = path.join(projectRoot, ".open-next", "worker.js");
  return [
    {
      status: existsSync(workerPath) ? "PASS" : "FAIL",
      label: "worker.js exists",
      detail: workerPath,
      action: "Run npm run deploy:build and confirm OpenNext generated .open-next/worker.js.",
    },
  ];
}

async function confirmDeploy() {
  if (!process.stdin.isTTY) {
    warn("Deploy confirmation", "Non-interactive terminal. Re-run with --yes to deploy automatically.");
    return false;
  }

  const reader = createInterface({ input, output });
  const answer = await reader.question("Type DEPLOY to run Wrangler deploy now, or press Enter to stop: ");
  reader.close();

  if (answer !== "DEPLOY") {
    warn("Deploy skipped", "Preflight passed; run npx wrangler deploy when ready.");
    return false;
  }

  return true;
}

async function executeDeploy() {
  console.log("");
  console.log("Running Wrangler deploy...");
  const result = await runWrangler(["deploy"]);
  if (result.code !== 0) {
    fail("Wrangler deploy", truncate(result.stderr || result.stdout || "wrangler deploy failed."));
    process.exit(1);
  }

  pass("Wrangler deploy", "Deployment completed.");
}

function printChecks(checks: Check[]) {
  for (const check of checks) {
    print(check.status, check.label, check.detail);
  }
}

function printSummary(checks: Check[]) {
  const passCount = checks.filter((check) => check.status === "PASS").length;
  const warnCount = checks.filter((check) => check.status === "WARN").length;
  const failCount = checks.filter((check) => check.status === "FAIL").length;
  const actions = checks.filter((check) => check.status !== "PASS" && check.action).map((check) => check.action as string);

  console.log("");
  console.log(`Summary: ${passCount} pass, ${warnCount} warn, ${failCount} fail`);
  if (actions.length > 0) {
    console.log("");
    console.log("Recommended next actions:");
    for (const action of [...new Set(actions)]) console.log(`- ${action}`);
  }
}

function required(label: string, value: string | null | undefined, action: string): Check {
  return {
    status: value ? "PASS" : "FAIL",
    label,
    detail: value || "Missing.",
    action,
  };
}

function defaultWarn(label: string, value: string | undefined, action: string): Check {
  if (!value) return { status: "FAIL", label, detail: "Missing.", action };
  const isDefault = defaultValues.has(value.toLowerCase());
  return {
    status: isDefault ? "WARN" : "PASS",
    label,
    detail: value,
    action: isDefault ? action : undefined,
  };
}

function gitRemoteCheck(remote: string | null): Check {
  if (!remote) {
    return {
      status: "WARN",
      label: "Git remote",
      detail: "No origin remote found.",
      action: "Add the new site's GitHub origin before publishing.",
    };
  }

  const lower = remote.toLowerCase();
  const oldRemote = lower.includes("content-site-starter") || lower.includes("contentforge-starter") || lower.includes("starter");
  return {
    status: oldRemote ? "WARN" : "PASS",
    label: "Git remote",
    detail: remote,
    action: oldRemote ? "Confirm this copied site is not using the old starter remote." : undefined,
  };
}

function ignoreCheck(lines: string[], pattern: string): Check {
  const ignored = lines.includes(pattern) || (pattern === ".env" && lines.some((line) => line === ".env" || line === ".env*"));
  return {
    status: ignored ? "PASS" : "FAIL",
    label: `${pattern} ignored`,
    detail: ignored ? "Ignored." : "Missing from .gitignore.",
    action: `Add ${pattern} to .gitignore.`,
  };
}

function readJson<T>(relativePath: string): T | null {
  const absolutePath = path.join(projectRoot, relativePath);
  if (!existsSync(absolutePath)) return null;
  return JSON.parse(readFileSync(absolutePath, "utf8")) as T;
}

function readGitignore() {
  const gitignorePath = path.join(projectRoot, ".gitignore");
  if (!existsSync(gitignorePath)) return [];
  return readFileSync(gitignorePath, "utf8")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

async function commandText(command: string, args: string[]) {
  const result = await runCommand(command, args);
  if (result.code !== 0) return null;
  return result.stdout.trim();
}

function hasFail(checks: Check[]) {
  return checks.some((check) => check.status === "FAIL");
}

function stop(message: string): never {
  console.log("");
  console.log(`✗ FAIL ${message}`);
  process.exit(1);
}

function pass(label: string, detail: string) {
  print("PASS", label, detail);
}

function warn(label: string, detail: string) {
  print("WARN", label, detail);
}

function fail(label: string, detail: string) {
  print("FAIL", label, detail);
}

function print(status: Status, label: string, detail: string) {
  const prefix = status === "PASS" ? "✓ PASS" : status === "WARN" ? "⚠ WARN" : "✗ FAIL";
  console.log(`${prefix} ${label} - ${detail}`);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Unknown publish error.";
  fail("Publish crashed", message);
  process.exitCode = 1;
});
