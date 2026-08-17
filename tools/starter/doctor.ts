import { existsSync } from "node:fs";
import path from "node:path";

import { printCheck, readJsoncFile, runCommand, truncate, type CheckStatus } from "./cli-utils";
import { resolveWranglerCommand, runWrangler, wranglerD1ListJson, wranglerR2BucketListJson, wranglerWhoami, type WranglerJsonRecord } from "./wrangler";

type WranglerConfig = {
  name?: string;
  assets?: {
    binding?: string;
    run_worker_first?: boolean;
  };
  d1_databases?: Array<{
    binding?: string;
    database_name?: string;
    database_id?: string;
  }>;
  r2_buckets?: Array<{
    binding?: string;
    bucket_name?: string;
  }>;
  vars?: Record<string, string>;
};

type CheckResult = {
  status: CheckStatus;
};

const requiredEnvVars = ["ADMIN_PASSWORD", "SESSION_SECRET", "NEXT_PUBLIC_SITE_URL", "R2_PUBLIC_BASE_URL"];

async function main() {
  const results: CheckResult[] = [];
  const configPath = path.join(process.cwd(), "wrangler.jsonc");
  const config = existsSync(configPath) ? readJsoncFile<WranglerConfig>(configPath) : null;

  console.log("Starter Doctor");
  console.log(`Project: ${process.cwd()}`);
  console.log("");

  results.push(checkPlatform());
  results.push(checkNode());
  results.push(await checkGit());
  results.push(await checkWrangler());
  results.push(await checkWhoami());
  results.push(checkWranglerConfig(config));
  results.push(...checkRequiredEnv(config));
  results.push(await checkD1(config));
  results.push(await checkR2(config));

  const failCount = results.filter((result) => result.status === "FAIL").length;
  const warningCount = results.filter((result) => result.status === "WARNING").length;

  console.log("");
  console.log(`Summary: ${failCount} fail, ${warningCount} warning`);
  if (failCount > 0) process.exitCode = 1;
}

function checkPlatform(): CheckResult {
  printCheck("PASS", "Current platform", `${process.platform} ${process.arch}`);
  return { status: "PASS" };
}

function checkNode(): CheckResult {
  const [majorRaw] = process.versions.node.split(".");
  const major = Number(majorRaw);

  if (major >= 22) {
    printCheck("PASS", "Node version", process.versions.node);
    return { status: "PASS" };
  }

  if (major >= 20) {
    printCheck("WARNING", "Node version", `${process.versions.node}; Node 22+ is recommended for this starter.`);
    return { status: "WARNING" };
  }

  printCheck("FAIL", "Node version", `${process.versions.node}; install Node 22+.`);
  return { status: "FAIL" };
}

async function checkGit(): Promise<CheckResult> {
  const result = await runCommand(process.platform === "win32" ? "git.exe" : "git", ["--version"]);
  if (result.code === 0) {
    printCheck("PASS", "Git installed", result.stdout.trim());
    return { status: "PASS" };
  }

  printCheck("FAIL", "Git installed", truncate(result.stderr || "Git command was not found."));
  return { status: "FAIL" };
}

async function checkWrangler(): Promise<CheckResult> {
  const wrangler = resolveWranglerCommand();
  const result = await runWrangler(["--version"]);

  if (result.code === 0) {
    printCheck("PASS", "Wrangler installed", `${result.stdout.trim()} (${wrangler.source})`);
    return { status: "PASS" };
  }

  printCheck("FAIL", "Wrangler installed", truncate(result.stderr || result.stdout || "Wrangler command was not found."));
  return { status: "FAIL" };
}

async function checkWhoami(): Promise<CheckResult> {
  const result = await wranglerWhoami();
  if (result.code === 0) {
    printCheck("PASS", "Wrangler login", firstLine(result.stdout));
    return { status: "PASS" };
  }

  printCheck("WARNING", "Wrangler login", "Run `wrangler login` before checking live D1/R2 resources or deploying.");
  return { status: "WARNING" };
}

function checkWranglerConfig(config: WranglerConfig | null): CheckResult {
  if (!config) {
    printCheck("FAIL", "wrangler.jsonc", "File not found.");
    return { status: "FAIL" };
  }

  const d1 = config.d1_databases?.find((database) => database.binding === "DB");
  const r2 = config.r2_buckets?.find((bucket) => bucket.binding === "MEDIA_BUCKET");
  const assetsBinding = config.assets?.binding === "ASSETS";

  const missing = [
    config.name ? null : "name",
    assetsBinding ? null : "assets.binding=ASSETS",
    d1?.database_name ? null : "D1 database_name",
    d1?.database_id ? null : "D1 database_id",
    r2?.bucket_name ? null : "R2 bucket_name",
  ].filter(Boolean);

  if (missing.length === 0) {
    printCheck("PASS", "Worker bindings", "ASSETS, DB, MEDIA_BUCKET are configured.");
    return { status: "PASS" };
  }

  printCheck("FAIL", "Worker bindings", `Missing: ${missing.join(", ")}`);
  return { status: "FAIL" };
}

function checkRequiredEnv(config: WranglerConfig | null): CheckResult[] {
  return requiredEnvVars.map((name) => {
    const isPublicVar = name.startsWith("NEXT_PUBLIC_") || name === "R2_PUBLIC_BASE_URL";
    const exists = Boolean(process.env[name] || config?.vars?.[name]);

    if (exists) {
      printCheck("PASS", `Env var ${name}`, process.env[name] ? "Available in current shell." : "Configured in wrangler.jsonc vars.");
      return { status: "PASS" };
    }

    const status: CheckStatus = isPublicVar ? "FAIL" : "WARNING";
    const details = isPublicVar ? "Add this to wrangler.jsonc vars or the deployment environment." : "Set this as a Cloudflare secret before production deploy.";
    printCheck(status, `Env var ${name}`, details);
    return { status };
  });
}

async function checkD1(config: WranglerConfig | null): Promise<CheckResult> {
  const d1 = config?.d1_databases?.find((database) => database.binding === "DB");
  if (!d1?.database_name || !d1.database_id) {
    printCheck("FAIL", "D1 exists", "DB binding needs database_name and database_id.");
    return { status: "FAIL" };
  }
  const databaseName = d1.database_name;
  const databaseId = d1.database_id;

  try {
    const databases = await wranglerD1ListJson();
    const found = databases.some((database) => recordMatches(database, databaseName, databaseId));
    if (found) {
      printCheck("PASS", "D1 exists", `${databaseName} (${databaseId})`);
      return { status: "PASS" };
    }

    printCheck("FAIL", "D1 exists", `${databaseName} was not found in this Cloudflare account.`);
    return { status: "FAIL" };
  } catch (error) {
    printCheck("WARNING", "D1 exists", `Could not query Cloudflare: ${errorMessage(error)}`);
    return { status: "WARNING" };
  }
}

async function checkR2(config: WranglerConfig | null): Promise<CheckResult> {
  const r2 = config?.r2_buckets?.find((bucket) => bucket.binding === "MEDIA_BUCKET");
  if (!r2?.bucket_name) {
    printCheck("FAIL", "R2 exists", "MEDIA_BUCKET binding needs bucket_name.");
    return { status: "FAIL" };
  }
  const bucketName = r2.bucket_name;

  try {
    const buckets = await wranglerR2BucketListJson();
    const found = buckets.some((bucket) => recordMatches(bucket, bucketName));
    if (found) {
      printCheck("PASS", "R2 exists", bucketName);
      return { status: "PASS" };
    }

    printCheck("FAIL", "R2 exists", `${bucketName} was not found in this Cloudflare account.`);
    return { status: "FAIL" };
  } catch (error) {
    printCheck("WARNING", "R2 exists", `Could not query Cloudflare: ${errorMessage(error)}`);
    return { status: "WARNING" };
  }
}

function recordMatches(record: WranglerJsonRecord, expectedName: string, expectedId?: string) {
  const values = [record.name, record.database_name, record.bucket_name, record.id, record.uuid, record.database_id]
    .filter((value): value is string => typeof value === "string")
    .map((value) => value.toLowerCase());

  return values.includes(expectedName.toLowerCase()) || Boolean(expectedId && values.includes(expectedId.toLowerCase()));
}

function firstLine(input: string) {
  return input.trim().split(/\r?\n/)[0] || "Authenticated.";
}

function errorMessage(error: unknown) {
  return error instanceof Error ? truncate(error.message) : "Unknown error.";
}

main().catch((error: unknown) => {
  printCheck("FAIL", "Doctor crashed", errorMessage(error));
  process.exitCode = 1;
});
