import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

type Step = {
  id: string;
  command: string;
  args: string[];
  required: boolean;
};

type StepResult = Step & {
  status: "pass" | "fail";
  output: string;
};

const steps: Step[] = [
  { id: "framework-version", command: "npm", args: ["run", "test:framework-version"], required: true },
  { id: "theme-discovery", command: "npm", args: ["run", "test:theme-discovery"], required: true },
  { id: "wrangler-deploy-parser", command: "npm", args: ["run", "test:wrangler-deploy-parsers"], required: true },
  { id: "production-resume", command: "npm", args: ["run", "test:production-resume"], required: true },
  { id: "import-fixture", command: "npx", args: ["tsx", "scripts/test-import-fixture-contract.ts"], required: true },
  { id: "fresh-site-zero-core-change", command: "npm", args: ["run", "test:fresh-site-freeze"], required: true },
];

function main() {
  const results = steps.map(runStep);
  const failed = results.filter((result) => result.status === "fail" && result.required);
  const verdict = failed.length > 0 ? "FAIL" : "PASS";
  const report = {
    generatedAt: new Date().toISOString(),
    verdict,
    productionWritesPerformed: false,
    realCloudflareWritesPerformed: false,
    steps: results.map((result) => ({
      id: result.id,
      status: result.status,
      required: result.required,
      command: `${result.command} ${result.args.join(" ")}`,
    })),
    acceptedWarnings: [
      "No real wrangler deploy --dry-run was executed automatically; Milestone 2 remains mock/fixture plus OpenNext bundle inspection.",
    ],
  };
  const reportPath = path.join(".contentforge", "freeze-acceptance-report.json");
  mkdirSync(path.dirname(reportPath), { recursive: true });
  writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

  console.log(`Freeze Acceptance: ${verdict}`);
  console.log(`Report: ${reportPath}`);
  for (const result of results) {
    console.log(`${result.status.toUpperCase()} ${result.id}`);
  }

  if (failed.length > 0) {
    for (const result of failed) {
      console.error(`\nFAIL ${result.id}\n${result.output}`);
    }
    process.exitCode = 1;
  }
}

function runStep(step: Step): StepResult {
  const command = npmLikeCommand(step.command);
  const useShell = process.platform === "win32" && (step.command === "npm" || step.command === "npx");
  const result = spawnSync(useShell ? [command, ...step.args].map(quoteShellArg).join(" ") : command, useShell ? [] : step.args, {
    cwd: process.cwd(),
    encoding: "utf8",
    shell: useShell,
    windowsHide: true,
    timeout: 900_000,
  });
  const output = [result.stdout, result.stderr, result.error ? String(result.error) : ""].filter(Boolean).join("\n");
  return {
    ...step,
    status: result.status === 0 ? "pass" : "fail",
    output,
  };
}

function npmLikeCommand(command: string) {
  if (process.platform !== "win32") return command;
  if (command === "npm") return "npm.cmd";
  if (command === "npx") return "npx.cmd";
  return command;
}

function quoteShellArg(value: string) {
  if (!/[()\s"&|<>^]/.test(value)) return value;
  return `"${value.replace(/"/g, '\\"')}"`;
}

main();
