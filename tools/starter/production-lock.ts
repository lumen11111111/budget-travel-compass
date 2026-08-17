import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import path from "node:path";

import { projectRoot } from "./cli-utils";
import type { RiskLevel } from "./cloudflare-execution";

export const productionLockRelativePath = path.join(".contentforge", "production-execution.lock");

export type ProductionExecutionLock = {
  operationId: string;
  pid: number;
  startedAt: string;
  mode: string;
  riskLevel: RiskLevel;
  targetSummary: string;
};

export function acquireProductionLock(input: Omit<ProductionExecutionLock, "pid" | "startedAt">): ProductionExecutionLock {
  const lockPath = path.join(projectRoot, productionLockRelativePath);
  mkdirSync(path.dirname(lockPath), { recursive: true });
  if (existsSync(lockPath)) {
    const current = readProductionLock();
    if (current && isPidAlive(current.pid)) {
      throw new Error(`Production execution lock is active for ${current.operationId} (pid ${current.pid}).`);
    }
    unlinkSync(lockPath);
  }

  const lock: ProductionExecutionLock = {
    ...input,
    pid: process.pid,
    startedAt: new Date().toISOString(),
  };
  writeFileSync(lockPath, `${JSON.stringify(lock, null, 2)}\n`, { encoding: "utf8", flag: "wx" });
  return lock;
}

export function releaseProductionLock(operationId: string) {
  const lock = readProductionLock();
  if (!lock || lock.operationId !== operationId) return;
  unlinkSync(path.join(projectRoot, productionLockRelativePath));
}

export function readProductionLock(): ProductionExecutionLock | null {
  const lockPath = path.join(projectRoot, productionLockRelativePath);
  if (!existsSync(lockPath)) return null;
  return JSON.parse(readFileSync(lockPath, "utf8")) as ProductionExecutionLock;
}

export function isPidAlive(pid: number) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}
