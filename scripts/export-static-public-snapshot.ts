import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import {
  buildLocalSnapshotSql,
  buildStaticPublicSnapshot,
  STATIC_PUBLIC_QUERIES,
  type SnapshotRow,
  type StaticPublicSnapshotData,
} from "./static-public/snapshot";

const EXPECTED_ACCOUNT_ID = "95d9b93db8abc73b05ceb93acc36745d";
const EXPECTED_DATABASE_ID = "28e229c2-c032-4c09-9490-630c1b88df50";
const EXPECTED_DATABASE_NAME = "budget-travel-compass";
const EXPECTED_WORKER_NAME = "budget-travel-compass";
const WRANGLER_BIN = path.join(process.cwd(), "node_modules", "wrangler", "bin", "wrangler.js");

function stripAnsi(value: string) {
  // eslint-disable-next-line no-control-regex -- ANSI escapes are control characters by definition.
  return value.replace(/\u001b\[[0-?]*[ -/]*[@-~]/g, "");
}

function runWrangler(args: string[]) {
  const result = spawnSync(process.execPath, [WRANGLER_BIN, ...args], {
    cwd: process.cwd(),
    encoding: "utf8",
    env: { ...process.env, NO_COLOR: "1" },
    maxBuffer: 64 * 1024 * 1024,
  });
  if (result.status !== 0) {
    throw new Error(`Wrangler failed: ${args.join(" ")}\n${result.error?.message ?? result.stderr ?? result.stdout}`);
  }
  return stripAnsi(result.stdout);
}

function readWranglerConfig() {
  const config = JSON.parse(readFileSync(path.join(process.cwd(), "wrangler.jsonc"), "utf8")) as {
    name?: string;
    d1_databases?: Array<{ database_id?: string; database_name?: string }>;
  };
  const database = config.d1_databases?.find((item) => item.database_name === EXPECTED_DATABASE_NAME);
  if (config.name !== EXPECTED_WORKER_NAME) throw new Error(`Unexpected Worker target: ${String(config.name)}.`);
  if (database?.database_id !== EXPECTED_DATABASE_ID) throw new Error("Unexpected D1 database target in wrangler.jsonc.");
}

function verifyAccount() {
  const whoami = runWrangler(["whoami"]);
  if (!whoami.includes(EXPECTED_ACCOUNT_ID)) {
    throw new Error(`Authenticated Cloudflare account does not match ${EXPECTED_ACCOUNT_ID}.`);
  }
}

function parseD1Rows(output: string, label: string): SnapshotRow[] {
  const jsonStart = output.indexOf("[");
  if (jsonStart < 0) throw new Error(`Wrangler returned no JSON for ${label}.`);
  const parsed = JSON.parse(output.slice(jsonStart)) as Array<{
    results?: SnapshotRow[];
    success?: boolean;
    meta?: { changed_db?: boolean; changes?: number; rows_written?: number };
  }>;
  if (parsed.length !== 1 || parsed[0]?.success !== true || !Array.isArray(parsed[0]?.results)) {
    throw new Error(`D1 query did not succeed for ${label}.`);
  }
  const meta = parsed[0].meta;
  if (meta?.changed_db || (meta?.changes ?? 0) !== 0 || (meta?.rows_written ?? 0) !== 0) {
    throw new Error(`Read-only snapshot query reported a write for ${label}.`);
  }
  return parsed[0].results;
}

function queryRows(label: keyof typeof STATIC_PUBLIC_QUERIES) {
  const output = runWrangler([
    "d1",
    "execute",
    EXPECTED_DATABASE_NAME,
    "--remote",
    "--json",
    "--command",
    STATIC_PUBLIC_QUERIES[label],
  ]);
  return parseD1Rows(output, label);
}

function outputDirectory() {
  const index = process.argv.indexOf("--out-dir");
  const value = index >= 0 ? process.argv[index + 1] : undefined;
  return path.resolve(process.cwd(), value || ".tmp/static-public");
}

function main() {
  readWranglerConfig();
  verifyAccount();

  const data: StaticPublicSnapshotData = {
    articles: queryRows("articles"),
    categories: queryRows("categories"),
    tags: queryRows("tags"),
    articleTags: queryRows("articleTags"),
    homepageBlocks: queryRows("homepageBlocks"),
    siteSettings: queryRows("siteSettings"),
  };
  const snapshot = buildStaticPublicSnapshot(data, {
    accountId: EXPECTED_ACCOUNT_ID,
    databaseId: EXPECTED_DATABASE_ID,
    databaseName: EXPECTED_DATABASE_NAME,
  });

  const outDir = outputDirectory();
  mkdirSync(outDir, { recursive: true });
  writeFileSync(path.join(outDir, "snapshot.json"), `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");
  writeFileSync(path.join(outDir, "snapshot.sql"), buildLocalSnapshotSql(snapshot), "utf8");
  writeFileSync(path.join(outDir, "manifest.json"), `${JSON.stringify(snapshot.manifest, null, 2)}\n`, "utf8");

  console.log(JSON.stringify({ outputDirectory: outDir, ...snapshot.manifest }, null, 2));
}

main();
