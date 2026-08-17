import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

type HashManifest = Record<string, string>;

const frameworkRoot = process.cwd();
const workspaceRoot = path.join(frameworkRoot, ".contentforge", "fresh-site-zero-core-change");
const instanceRoot = path.join(workspaceRoot, "freeze-fixture-site");
const reportPath = path.join(frameworkRoot, ".contentforge", "fresh-site-zero-core-change-report.json");
const coreRoots = ["src", "tools", "scripts", "frontend-library", "docs/framework-upgrades", "docs/audits"];
const coreFiles = [
  ".contentforge-version",
  "framework.version.json",
  "framework.manifest.json",
  "package.json",
  "package-lock.json",
  "next.config.ts",
  "open-next.config.ts",
  "wrangler.jsonc",
];

async function main() {
  const before = hashFrameworkCore();
  rmInsideWorkspace(workspaceRoot);
  mkdirSync(workspaceRoot, { recursive: true });

  const create = run("npm", [
    "run",
    "create-instance",
    "--",
    "--theme=freeze-fixture",
    "--site-name=ContentForge Freeze Fixture",
    `--output=${instanceRoot}`,
  ], {
    env: { CONTENTFORGE_ACCEPT_PLACEHOLDER_CONFIG: "1" },
  });

  assert.equal(create.status, 0, create.output);
  assert(existsSync(path.join(instanceRoot, "src", "instance", "theme.definition.ts")), "instance theme definition must be generated");
  assert(existsSync(path.join(instanceRoot, "src", "instance", "theme-runtime.ts")), "instance theme runtime must be generated");

  const doctor = run("npm", ["run", "doctor"], { cwd: instanceRoot, env: { CONTENTFORGE_ACCEPT_PLACEHOLDER_CONFIG: "1" } });
  assert.equal(doctor.status, 0, doctor.output);

  const typecheck = run("npm", ["run", "typecheck"], { cwd: instanceRoot });
  assert.equal(typecheck.status, 0, typecheck.output);

  const build = run("npm", ["run", "build"], {
    cwd: instanceRoot,
    env: {
      CONTENTFORGE_ALLOW_PRODUCTION_FALLBACK: "0",
      NEXT_PUBLIC_SITE_URL: "https://contentforge-it-freeze.example.workers.dev",
      R2_PUBLIC_BASE_URL: "https://contentforge-it-freeze.example.workers.dev/media",
    },
  });
  assert.equal(build.status, 0, build.output);

  const deployBuild = run("npm", ["run", "deploy:build"], {
    cwd: instanceRoot,
    env: {
      CONTENTFORGE_ALLOW_PRODUCTION_FALLBACK: "0",
      NEXT_PUBLIC_SITE_URL: "https://contentforge-it-freeze.example.workers.dev",
      R2_PUBLIC_BASE_URL: "https://contentforge-it-freeze.example.workers.dev/media",
    },
  });
  assert.equal(deployBuild.status, 0, deployBuild.output);
  assertThemeRuntimeBundled(instanceRoot);

  const after = hashFrameworkCore();
  assert.deepEqual(after, before, "Framework-owned/runtime-owned core source hashes changed during fresh-site creation");

  writeFileSync(reportPath, `${JSON.stringify({
    generatedAt: new Date().toISOString(),
    instanceRoot,
    frameworkCoreDiff: 0,
    commands: [
      "npm run create-instance -- --theme=freeze-fixture",
      "npm run doctor",
      "npm run typecheck",
      "npm run build",
      "npm run deploy:build",
      "inspect .open-next worker bundle",
    ],
    coreHashCount: Object.keys(after).length,
  }, null, 2)}\n`, "utf8");

  rmInsideWorkspace(workspaceRoot);
  console.log("PASS fresh-site zero-core-change tests");
}

function run(command: string, args: string[], options: { cwd?: string; env?: Partial<NodeJS.ProcessEnv> } = {}) {
  const executable = command === "npm" && process.platform === "win32" ? "npm.cmd" : command;
  const useShell = process.platform === "win32" && command === "npm";
  const result = spawnSync(useShell ? [executable, ...args].map(quoteShellArg).join(" ") : executable, useShell ? [] : args, {
    cwd: options.cwd ?? frameworkRoot,
    env: { ...process.env, ...options.env },
    encoding: "utf8",
    shell: useShell,
    windowsHide: true,
    timeout: 300_000,
  });
  return {
    status: result.status,
    output: [
      `command=${command} ${args.join(" ")}`,
      result.stdout,
      result.stderr,
      result.error ? String(result.error) : "",
    ].filter(Boolean).join("\n"),
  };
}

function quoteShellArg(value: string) {
  if (!/[()\s"&|<>^]/.test(value)) return value;
  return `"${value.replace(/"/g, '\\"')}"`;
}

function hashFrameworkCore(): HashManifest {
  const files = [
    ...coreFiles.filter((file) => existsSync(path.join(frameworkRoot, file))),
    ...coreRoots.flatMap((root) => listFiles(path.join(frameworkRoot, root)).map((file) => path.relative(frameworkRoot, file))),
  ].sort((a, b) => a.localeCompare(b));
  return Object.fromEntries(files.map((file) => [normalize(file), sha256(path.join(frameworkRoot, file))]));
}

function listFiles(root: string, options: { includeGenerated?: boolean } = {}): string[] {
  if (!existsSync(root)) return [];
  const entries = readdirSync(root).flatMap((entry) => {
    const fullPath = path.join(root, entry);
    const relative = normalize(path.relative(frameworkRoot, fullPath));
    if (!options.includeGenerated && shouldIgnore(relative)) return [];
    const stats = statSync(fullPath);
    if (stats.isDirectory()) return listFiles(fullPath, options);
    return stats.isFile() ? [fullPath] : [];
  });
  return entries;
}

function shouldIgnore(relativePath: string) {
  return /(^|\/)(node_modules|\.next|\.open-next|\.wrangler|\.contentforge|dist|coverage)(\/|$)/.test(relativePath);
}

function sha256(filePath: string) {
  return createHash("sha256").update(readFileSync(filePath)).digest("hex");
}

function normalize(value: string) {
  return value.split(path.sep).join("/");
}

function assertThemeRuntimeBundled(root: string) {
  const openNextRoot = path.join(root, ".open-next");
  assert(existsSync(openNextRoot), ".open-next output must exist after deploy:build");
  const bundleText = listFiles(openNextRoot, { includeGenerated: true })
    .filter((file) => /\.(js|mjs|cjs|json|txt)$/i.test(file))
    .map((file) => readFileSync(file, "utf8"))
    .join("\n");
  assert(bundleText.includes("frontend-library/freeze-fixture") || bundleText.includes("Freeze Fixture") || bundleText.includes("freeze-fixture"), "selected theme runtime files must be present in OpenNext output");
}

function rmInsideWorkspace(target: string) {
  const resolved = path.resolve(target);
  const allowed = path.resolve(frameworkRoot, ".contentforge", "fresh-site-zero-core-change");
  if (resolved !== allowed && !resolved.startsWith(`${allowed}${path.sep}`)) {
    throw new Error(`Refusing to remove path outside fresh-site workspace: ${resolved}`);
  }
  rmSync(resolved, { recursive: true, force: true, maxRetries: 10, retryDelay: 250 });
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
