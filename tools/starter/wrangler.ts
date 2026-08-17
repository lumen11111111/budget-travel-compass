import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";

import { projectRoot, runCommand, type CommandResult, type RunCommandOptions } from "./cli-utils";

export type WranglerCommand = {
  command: string;
  argsPrefix: string[];
  source: "local" | "npx-no-install" | "global";
  localPinned: boolean;
};

export type WranglerJsonRecord = Record<string, unknown>;

export type WranglerCommandResult = {
  ok: boolean;
  command: string;
  args: string[];
  sanitizedArgs: string[];
  exitCode: number | null;
  signal?: NodeJS.Signals | null;
  stdout: string;
  stderr: string;
  durationMs: number;
  timedOut: boolean;
  interactivePromptDetected: boolean;
  errorCode?: string;
  source: WranglerCommand["source"];
  localPinned: boolean;
};

export type RunWranglerCommandOptions = {
  args: string[];
  cwd?: string;
  accountId?: string;
  timeoutMs?: number;
  allowGlobalFallback?: boolean;
  stdin?: string;
};

const defaultTimeoutMs = 30_000;
const promptPatterns = [
  /\bpress enter\b/i,
  /\bconfirm\b/i,
  /\bare you sure\b/i,
  /\bselect an account\b/i,
  /\bpassword\b/i,
  /\blog in\b/i,
  /\bwould you like\b/i,
];

export function resolveWranglerCommand(cwd = projectRoot, options: { allowGlobalFallback?: boolean } = {}): WranglerCommand {
  const localScript = path.join(cwd, "node_modules", "wrangler", "bin", "wrangler.js");

  if (existsSync(localScript)) {
    return {
      command: process.execPath,
      argsPrefix: [localScript],
      source: "local",
      localPinned: true,
    };
  }

  if (process.platform === "win32") {
    return {
      command: "npx.cmd",
      argsPrefix: ["--no-install", "wrangler"],
      source: "npx-no-install",
      localPinned: false,
    };
  }

  if (!options.allowGlobalFallback && process.env.CONTENTFORGE_ALLOW_GLOBAL_WRANGLER !== "true") {
    return {
      command: "npx",
      argsPrefix: ["--no-install", "wrangler"],
      source: "npx-no-install",
      localPinned: false,
    };
  }

  return {
    command: "wrangler",
    argsPrefix: [],
    source: "global",
    localPinned: false,
  };
}

export function runWrangler(args: string[], options: RunCommandOptions = {}): Promise<CommandResult> {
  const wrangler = resolveWranglerCommand(options.cwd ?? projectRoot, { allowGlobalFallback: true });
  return runCommand(wrangler.command, [...wrangler.argsPrefix, ...args], options);
}

export function runWranglerCommand(options: RunWranglerCommandOptions): Promise<WranglerCommandResult> {
  const startedAt = Date.now();
  const cwd = options.cwd ?? projectRoot;
  const wrangler = resolveWranglerCommand(cwd, { allowGlobalFallback: options.allowGlobalFallback });
  const args = [...wrangler.argsPrefix, ...options.args];
  const timeoutMs = options.timeoutMs ?? defaultTimeoutMs;
  const env = { ...process.env };
  if (options.accountId) env.CLOUDFLARE_ACCOUNT_ID = options.accountId;

  return new Promise((resolve) => {
    const child = spawn(wrangler.command, args, {
      cwd,
      env,
      shell: false,
      stdio: [options.stdin === undefined ? "ignore" : "pipe", "pipe", "pipe"],
      windowsHide: true,
    });

    let stdout = "";
    let stderr = "";
    let timedOut = false;
    let settled = false;
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill();
    }, timeoutMs);

    const finish = (result: Omit<WranglerCommandResult, "durationMs" | "timedOut" | "interactivePromptDetected" | "sanitizedArgs" | "source" | "localPinned">) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      const output = `${stdout}\n${stderr}`;
      const fallbackNo = /Using fallback value in non-interactive context:\s*no/i.test(output);
      const interactivePromptDetected = !fallbackNo && promptPatterns.some((pattern) => pattern.test(output));
      const errorCode = result.errorCode ?? (timedOut ? "WRANGLER_COMMAND_TIMEOUT" : interactivePromptDetected ? "WRANGLER_INTERACTIVE_PROMPT" : result.exitCode === 0 ? undefined : "WRANGLER_COMMAND_FAILED");
      resolve({
        ...result,
        ok: result.ok && !timedOut && !interactivePromptDetected,
        stdout: sanitizeWranglerOutput(stdout),
        stderr: sanitizeWranglerOutput(stderr),
        args: options.args,
        sanitizedArgs: sanitizeWranglerArgs(options.args),
        durationMs: Date.now() - startedAt,
        timedOut,
        interactivePromptDetected,
        errorCode,
        source: wrangler.source,
        localPinned: wrangler.localPinned,
      });
    };

    child.stdout?.on("data", (chunk: Buffer) => {
      stdout += chunk.toString("utf8");
    });
    child.stderr?.on("data", (chunk: Buffer) => {
      stderr += chunk.toString("utf8");
    });
    child.on("error", (error) => {
      stderr ||= error.message;
      finish({ ok: false, command: "wrangler", args: options.args, exitCode: 1, signal: null, stdout, stderr, errorCode: "WRANGLER_SPAWN_FAILED" });
    });
    child.on("close", (code, signal) => {
      finish({ ok: code === 0, command: "wrangler", args: options.args, exitCode: code, signal, stdout, stderr });
    });

    if (options.stdin !== undefined) {
      child.stdin?.write(options.stdin);
      child.stdin?.end();
    }
  });
}

export function wranglerWhoami() {
  return runWrangler(["whoami"]);
}

export function wranglerD1Execute(databaseName: string, args: string[]) {
  return runWrangler(["d1", "execute", databaseName, ...args]);
}

export function wranglerR2ObjectPut(bucketName: string, objectKey: string, filePath: string, remote = false) {
  const args = ["r2", "object", "put", `${bucketName}/${objectKey}`, "--file", filePath];
  if (remote) args.push("--remote");
  return runWrangler(args);
}

export function wranglerR2ObjectDelete(bucketName: string, objectKey: string, remote = false) {
  const args = ["r2", "object", "delete", `${bucketName}/${objectKey}`];
  if (remote) args.push("--remote");
  return runWrangler(args);
}

export async function wranglerD1ListJson() {
  const result = await runWrangler(["d1", "list", "--json"]);
  return parseWranglerJsonArray(result);
}

export async function wranglerR2BucketListJson() {
  const result = await runWrangler(["r2", "bucket", "list"]);
  if (result.code !== 0) {
    throw new Error(result.stderr || result.stdout || "Wrangler command failed.");
  }

  return result.stdout
    .split(/\r?\n/)
    .map((line) => line.match(/^name:\s+(.+)$/)?.[1]?.trim())
    .filter((name): name is string => Boolean(name))
    .map((name) => ({ name }));
}

function parseWranglerJsonArray(result: CommandResult): WranglerJsonRecord[] {
  if (result.code !== 0) {
    throw new Error(result.stderr || result.stdout || "Wrangler command failed.");
  }

  const parsed = JSON.parse(result.stdout || "[]") as unknown;
  if (Array.isArray(parsed)) return parsed.filter(isRecord);
  if (isRecord(parsed) && Array.isArray(parsed.result)) return parsed.result.filter(isRecord);
  return [];
}

function isRecord(value: unknown): value is WranglerJsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function sanitizeWranglerOutput(value: string) {
  return value
    .replace(/(Bearer\s+)[A-Za-z0-9._-]+/g, "$1***")
    .replace(/(Authorization:\s*)[^\r\n]+/gi, "$1***")
    .replace(/(CONTENTFORGE_ADMIN_PASSWORD\s*=\s*)[^\s]+/g, "$1***")
    .replace(/(CLOUDFLARE_API_TOKEN\s*=\s*)[^\s]+/g, "$1***")
    .replace(/(CF_API_TOKEN\s*=\s*)[^\s]+/g, "$1***");
}

export function sanitizeWranglerArgs(args: string[]) {
  return args.map((arg, index) => {
    const previous = args[index - 1] ?? "";
    if (/^(--token|--password|--secret|--authorization)$/i.test(previous)) return "***";
    if (/^(Bearer\s+)[A-Za-z0-9._-]+/i.test(arg)) return "***";
    if (/^[A-Za-z0-9_-]{32,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}$/.test(arg)) return "***";
    return sanitizeWranglerOutput(arg);
  });
}
