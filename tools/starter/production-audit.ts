import { appendFileSync, mkdirSync, readFileSync, existsSync } from "node:fs";
import path from "node:path";

import { projectRoot } from "./cli-utils";
import type { AllowFlags, OperationStepState, RiskLevel } from "./cloudflare-execution";

export const productionOperationsRelativePath = path.join(".contentforge", "production-operations.jsonl");

export type ProductionOperationRecord = {
  operationId: string;
  timestamp: string;
  startedAt?: string;
  completedAt?: string;
  riskLevel: RiskLevel;
  stepId: string;
  operationKey: string;
  accountId: string;
  resourceType: string;
  resourceName: string;
  resourceId?: string;
  action: string;
  mode: string;
  confirmation: "not-required" | "yes" | "interactive";
  allowFlagsUsed: Array<keyof AllowFlags>;
  targetSummary: string;
  planHash: string;
  previousState: OperationStepState | string;
  resultingState: OperationStepState | string;
  result: "success" | "blocked" | "failed" | "skipped";
  outcome?: "success" | "blocked" | "failed" | "skipped";
  duration: number;
  errorCode?: string;
  errorMessage?: string;
  evidence?: string;
  retryable: boolean;
};

export function appendOperationRecord(record: ProductionOperationRecord) {
  const safe = sanitizeOperationRecord(record);
  const filePath = path.join(projectRoot, productionOperationsRelativePath);
  mkdirSync(path.dirname(filePath), { recursive: true });
  appendFileSync(filePath, `${JSON.stringify(safe)}\n`, "utf8");
}

export function readOperationRecords(): ProductionOperationRecord[] {
  const filePath = path.join(projectRoot, productionOperationsRelativePath);
  if (!existsSync(filePath)) return [];
  return readFileSync(filePath, "utf8")
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => JSON.parse(line) as ProductionOperationRecord);
}

export function sanitizeOperationRecord<T>(record: T): T {
  const text = JSON.stringify(record)
    .replace(/(Bearer\s+)[A-Za-z0-9._-]+/g, "$1***")
    .replace(/(Authorization\\?":\\?")[^"]+/gi, "$1***")
    .replace(/(ADMIN_PASSWORD\\?":\\?")[^"]+/g, "$1configured")
    .replace(/(SESSION_SECRET\\?":\\?")[^"]+/g, "$1configured");
  return JSON.parse(text) as T;
}
