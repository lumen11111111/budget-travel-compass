import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { existsSync } from "node:fs";
import path from "node:path";

import { projectRoot, readJsoncFile, runCommand, truncate, type CommandResult } from "./cli-utils";
import { wranglerD1Execute } from "./wrangler";

type Status = "PASS" | "WARN" | "FAIL";

type WranglerConfig = {
  d1_databases?: Array<{
    binding?: string;
    database_name?: string;
    database_id?: string;
  }>;
};

type Options = {
  yes: boolean;
};

type JsonRecord = Record<string, unknown>;

const placeholderUuid = "00000000-0000-0000-0000-000000000000";
const requiredTables = ["articles", "categories", "tags", "article_tags", "homepage_blocks"];
const countTables = ["articles", "categories", "tags", "homepage_blocks"];

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const config = readJsoncFile<WranglerConfig>(path.join(projectRoot, "wrangler.jsonc"));
  const database = config.d1_databases?.find((candidate) => candidate.binding === "DB");

  console.log("D1 Init");
  console.log("");

  if (!database) fail("D1 binding", "Missing d1_databases entry with binding DB.");
  if (!database.database_name) fail("D1 database_name", "Missing database_name for DB binding.");
  if (!database.database_id) fail("D1 database_id", "Missing database_id for DB binding.");
  if (database.database_id === placeholderUuid) fail("D1 database_id", "Placeholder database_id is not allowed.");

  pass("D1 binding", "Found DB.");
  pass("D1 database", `${database.database_name} (${database.database_id})`);
  warn("Remote write", "This command writes migrations and seed data to remote D1 by default.");

  await confirmRemoteWrite(database.database_name, options);
  await applySqlFile(database.database_name, "src/db/migrations/0001_initial.sql", "Apply migration");
  await runSeedWriter();
  await applySqlFile(database.database_name, "data/d1-seed.sql", "Apply seed SQL");
  await verifyTables(database.database_name);
  await verifyCounts(database.database_name);

  console.log("");
  pass("D1 initialization complete", "Remote D1 is ready for production article publishing.");
}

function parseArgs(args: string[]): Options {
  const options = { yes: false };

  for (const arg of args) {
    if (arg === "--yes") {
      options.yes = true;
    } else if (arg === "--help") {
      printHelp();
      process.exit(0);
    } else {
      fail("Argument", `Unknown argument: ${arg}`);
    }
  }

  return options;
}

function printHelp() {
  console.log("Usage:");
  console.log("  npm run d1:init");
  console.log("  npm run d1:init -- --yes");
  console.log("");
  console.log("This command applies migrations and seed SQL to remote D1.");
}

async function confirmRemoteWrite(databaseName: string, options: Options) {
  if (options.yes) {
    pass("Confirmation", "--yes provided.");
    return;
  }

  if (!process.stdin.isTTY) {
    fail("Confirmation", "Non-interactive terminal. Re-run with --yes if this is intentional.");
  }

  const reader = createInterface({ input, output });
  const answer = await reader.question(`Type INIT to initialize remote D1 database "${databaseName}": `);
  reader.close();

  if (answer !== "INIT") {
    fail("Confirmation", "Remote D1 initialization cancelled.");
  }

  pass("Confirmation", "INIT accepted.");
}

async function applySqlFile(databaseName: string, relativePath: string, label: string) {
  const sqlPath = path.join(projectRoot, relativePath);
  if (!existsSync(sqlPath)) fail(label, `Missing SQL file: ${relativePath}`);

  const result = await wranglerD1Execute(databaseName, ["--remote", "--yes", "--file", relativePath]);
  ensureCommand(label, result);
  pass(label, `${relativePath} applied to remote D1.`);
}

async function runSeedWriter() {
  const npmExecPath = process.env.npm_execpath;

  if (npmExecPath && existsSync(npmExecPath)) {
    const result = await runCommand(process.execPath, [npmExecPath, "run", "db:d1-seed:write"]);
    ensureCommand("Generate seed SQL", result);
    pass("Generate seed SQL", "npm run db:d1-seed:write completed.");
    return;
  }

  const tsxCli = path.join(projectRoot, "node_modules", "tsx", "dist", "cli.mjs");
  if (!existsSync(tsxCli)) fail("Generate seed SQL", "Could not find npm_execpath or local tsx CLI.");

  const result = await runCommand(process.execPath, [tsxCli, "src/db/generate-d1-seed.ts", "--out=data/d1-seed.sql"]);
  ensureCommand("Generate seed SQL", result);
  pass("Generate seed SQL", "data/d1-seed.sql generated.");
}

async function verifyTables(databaseName: string) {
  const quotedTables = requiredTables.map((table) => `'${table}'`).join(", ");
  const result = await wranglerD1Execute(databaseName, [
    "--remote",
    "--json",
    "--command",
    `SELECT name FROM sqlite_master WHERE type = 'table' AND name IN (${quotedTables});`,
  ]);

  ensureCommand("Verify tables", result);
  const rows = parseD1Rows(result.stdout);
  const foundTables = new Set(rows.map((row) => stringValue(row.name)).filter(Boolean));
  const missingTables = requiredTables.filter((table) => !foundTables.has(table));

  if (missingTables.length > 0) {
    fail("Verify tables", `Missing tables: ${missingTables.join(", ")}`);
  }

  pass("Verify tables", requiredTables.join(", "));
}

async function verifyCounts(databaseName: string) {
  for (const table of countTables) {
    const result = await wranglerD1Execute(databaseName, ["--remote", "--json", "--command", `SELECT COUNT(*) AS count FROM ${table};`]);
    ensureCommand(`Verify ${table} count`, result);

    const rows = parseD1Rows(result.stdout);
    const count = numberValue(rows[0]?.count);
    if (count === null) fail(`Verify ${table} count`, "Could not read count from D1 output.");
    if (count <= 0) fail(`Verify ${table} count`, `Expected seeded rows, found ${count}.`);

    pass(`Verify ${table} count`, String(count));
  }
}

function parseD1Rows(stdout: string): JsonRecord[] {
  const parsed = JSON.parse(stdout || "[]") as unknown;
  return extractRows(parsed);
}

function extractRows(value: unknown): JsonRecord[] {
  if (Array.isArray(value)) {
    return value.flatMap((item) => extractRows(item));
  }

  if (!isRecord(value)) return [];

  if (Array.isArray(value.results)) return value.results.filter(isRecord);
  if (Array.isArray(value.result)) return value.result.flatMap((item) => extractRows(item));

  return [];
}

function ensureCommand(label: string, result: CommandResult) {
  if (result.code !== 0) {
    fail(label, truncate(result.stderr || result.stdout || "Command failed."));
  }
}

function pass(label: string, detail: string) {
  print("PASS", label, detail);
}

function warn(label: string, detail: string) {
  print("WARN", label, detail);
}

function fail(label: string, detail: string): never {
  print("FAIL", label, detail);
  process.exit(1);
}

function print(status: Status, label: string, detail: string) {
  const prefix = status === "PASS" ? "✓ PASS" : status === "WARN" ? "⚠ WARN" : "✗ FAIL";
  console.log(`${prefix} ${label} - ${detail}`);
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value : null;
}

function numberValue(value: unknown) {
  if (typeof value === "number") return value;
  if (typeof value === "string" && /^\d+$/.test(value)) return Number(value);
  return null;
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Unknown D1 init error.";
  fail("D1 init crashed", message);
});
