import crypto from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { projectRoot } from "./cli-utils";

export const productionPatchesRelativeDir = path.join(".contentforge", "production-patches");

export type ProductionPatchJournal = {
  operationId: string;
  targetFile: string;
  beforeHash: string;
  afterHash: string;
  patchSummary: string;
  backupPath: string;
  rollbackAvailable: boolean;
  rollbackStatus: "available" | "blocked" | "applied" | "not-required";
};

export function writePatchJournal(input: {
  operationId: string;
  targetFile: string;
  patchSummary: string;
  write: (current: string) => string;
}): ProductionPatchJournal {
  const absoluteTarget = path.isAbsolute(input.targetFile) ? input.targetFile : path.join(projectRoot, input.targetFile);
  const relativeTarget = normalize(path.relative(projectRoot, absoluteTarget));
  const before = existsSync(absoluteTarget) ? readFileSync(absoluteTarget, "utf8") : "";
  const beforeHash = sha256(before);
  const patchDir = path.join(projectRoot, productionPatchesRelativeDir);
  const backupDir = path.join(patchDir, "backups");
  mkdirSync(backupDir, { recursive: true });
  const backupPath = path.join(backupDir, `${input.operationId}-${path.basename(absoluteTarget)}.bak`);
  if (existsSync(absoluteTarget)) copyFileSync(absoluteTarget, backupPath);
  else writeFileSync(backupPath, "", "utf8");

  const next = input.write(before);
  writeFileSync(absoluteTarget, next, "utf8");
  const afterHash = sha256(next);
  const journal: ProductionPatchJournal = {
    operationId: input.operationId,
    targetFile: relativeTarget,
    beforeHash,
    afterHash,
    patchSummary: input.patchSummary,
    backupPath: normalize(path.relative(projectRoot, backupPath)),
    rollbackAvailable: true,
    rollbackStatus: "available",
  };
  writeFileSync(path.join(patchDir, `${input.operationId}.json`), `${JSON.stringify(journal, null, 2)}\n`, "utf8");
  return journal;
}

export function rollbackPatchJournal(operationId: string): ProductionPatchJournal {
  const journalPath = path.join(projectRoot, productionPatchesRelativeDir, `${operationId}.json`);
  const journal = JSON.parse(readFileSync(journalPath, "utf8")) as ProductionPatchJournal;
  const targetPath = path.join(projectRoot, journal.targetFile);
  const current = existsSync(targetPath) ? readFileSync(targetPath, "utf8") : "";
  if (sha256(current) !== journal.afterHash) {
    journal.rollbackStatus = "blocked";
    writeFileSync(journalPath, `${JSON.stringify(journal, null, 2)}\n`, "utf8");
    throw new Error("Rollback blocked because target file changed after the patch.");
  }
  const backup = readFileSync(path.join(projectRoot, journal.backupPath), "utf8");
  writeFileSync(targetPath, backup, "utf8");
  journal.rollbackStatus = "applied";
  writeFileSync(journalPath, `${JSON.stringify(journal, null, 2)}\n`, "utf8");
  return journal;
}

export function sha256(value: string) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function normalize(input: string) {
  return input.replace(/\\/g, "/");
}
