import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const planPath = path.join(".contentforge", "import-fixture-plan.json");
const source = path.join("tools", "starter", "fixtures", "import", "freeze-content");

function main() {
  rmSync(planPath, { force: true });
  mkdirSync(path.dirname(planPath), { recursive: true });

  const command = process.platform === "win32" ? "npm.cmd" : "npm";
  const args = [
    "run",
    "import:articles",
    "--",
    `--source=${source}`,
    "--dry-run",
    "--allowlist=published-freeze-sample,draft-freeze-sample",
    `--plan=${planPath}`,
  ];
  const useShell = process.platform === "win32";
  const result = spawnSync(useShell ? [command, ...args].map(quoteShellArg).join(" ") : command, useShell ? [] : args, {
    cwd: process.cwd(),
    encoding: "utf8",
    shell: useShell,
    windowsHide: true,
    timeout: 120_000,
  });

  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  assert(existsSync(planPath), "import dry-run must write a plan");
  const plan = JSON.parse(readFileSync(planPath, "utf8")) as {
    dryRun?: boolean;
    articles?: Array<{ slug: string; status: string; coverObjectKey: string | null }>;
  };
  assert.equal(plan.dryRun, true);
  assert.equal(plan.articles?.length, 2);
  assert(plan.articles?.some((article) => article.slug === "published-freeze-sample" && article.status === "published"));
  assert(plan.articles?.some((article) => article.slug === "draft-freeze-sample" && article.status === "draft"));
  assert(plan.articles?.every((article) => article.coverObjectKey), "fixture articles must include image object keys");

  console.log("PASS import fixture contract tests");
}

function quoteShellArg(value: string) {
  if (!/[()\s"&|<>^]/.test(value)) return value;
  return `"${value.replace(/"/g, '\\"')}"`;
}

main();
