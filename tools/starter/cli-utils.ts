import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

export type CheckStatus = "PASS" | "WARNING" | "FAIL";

export type CommandResult = {
  code: number | null;
  stdout: string;
  stderr: string;
};

export type RunCommandOptions = {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  shell?: boolean;
};

export const projectRoot = process.cwd();

export function printCheck(status: CheckStatus, label: string, details?: string) {
  const prefix = status === "PASS" ? "✓ PASS" : status === "WARNING" ? "⚠ WARNING" : "✗ FAIL";
  console.log(`${prefix} ${label}${details ? ` - ${details}` : ""}`);
}

export function runCommand(command: string, args: string[], options: RunCommandOptions = {}): Promise<CommandResult> {
  return new Promise((resolve) => {
    const useShell = options.shell ?? false;
    const child = spawn(useShell ? buildShellCommand(command, args) : command, useShell ? [] : args, {
      cwd: options.cwd ?? projectRoot,
      env: { ...process.env, ...options.env },
      shell: useShell,
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString("utf8");
    });

    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString("utf8");
    });

    child.on("error", (error) => {
      resolve({ code: 1, stdout, stderr: stderr || error.message });
    });

    child.on("close", (code) => {
      resolve({ code, stdout, stderr });
    });
  });
}

function buildShellCommand(command: string, args: string[]) {
  return [command, ...args].map(quoteShellArg).join(" ");
}

function quoteShellArg(value: string) {
  if (!/[()\s"&|<>^]/.test(value)) return value;

  if (process.platform === "win32") {
    return `"${value.replace(/"/g, '\\"')}"`;
  }

  return `'${value.replace(/'/g, "'\\''")}'`;
}

export function stripJsonComments(input: string) {
  let output = "";
  let inString = false;
  let escaped = false;
  let inLineComment = false;
  let inBlockComment = false;

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];
    const next = input[index + 1];

    if (inLineComment) {
      if (char === "\n" || char === "\r") {
        inLineComment = false;
        output += char;
      }
      continue;
    }

    if (inBlockComment) {
      if (char === "*" && next === "/") {
        inBlockComment = false;
        index += 1;
      }
      continue;
    }

    if (!inString && char === "/" && next === "/") {
      inLineComment = true;
      index += 1;
      continue;
    }

    if (!inString && char === "/" && next === "*") {
      inBlockComment = true;
      index += 1;
      continue;
    }

    output += char;

    if (char === "\\" && inString) {
      escaped = !escaped;
      continue;
    }

    if (char === "\"" && !escaped) {
      inString = !inString;
    }

    if (char !== "\\") {
      escaped = false;
    }
  }

  return output;
}

export function readJsoncFile<T>(filePath: string): T {
  const raw = readFileSync(filePath, "utf8");
  return JSON.parse(stripJsonComments(raw)) as T;
}

export function fileExists(relativePath: string) {
  return existsSync(path.join(projectRoot, relativePath));
}

export function normalizeSlash(input: string) {
  return input.split(path.sep).join("/");
}

export function truncate(input: string, maxLength = 500) {
  const value = input.trim();
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength)}...`;
}
