import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { normalizeSlash } from "./cli-utils";

export type DatabaseExecutionMode = "local" | "remote";

export type ImportError = {
  code: string;
  message: string;
  step?: string;
};

export type ImportDatabaseRow = {
  kind: "article" | "article_tag" | "media_asset";
  key: string;
};

export type ImportArticlePlan = {
  slug: string;
  articleInsertSql: string;
  tagInsertSql: string[];
  mediaInsertSql: string[];
  r2ObjectKeys: string[];
  rollbackSql: string[];
};

export type ImportPlanV2 = {
  jobId: string;
  generatedAt: string;
  dryRun: boolean;
  executionMode: DatabaseExecutionMode;
  sourceDir: string;
  databaseName: string;
  bucketName: string;
  r2PublicBaseUrl: string;
  articles: ImportArticlePlan[];
};

export type ImportResult = {
  jobId: string;
  status: "success" | "failed" | "rolled-back" | "rollback-failed";
  articleIds: Array<{ slug: string; id: number | null }>;
  uploadedObjects: string[];
  createdDatabaseRows: ImportDatabaseRow[];
  skippedExistingObjects: string[];
  errors: ImportError[];
  rollbackStatus: "not-needed" | "not-run" | "success" | "partial" | "failed";
};

export type ImportExecutors = {
  putObject: (objectKey: string, sourcePath: string) => Promise<void>;
  deleteObject: (objectKey: string) => Promise<void>;
  executeSql: (sql: string) => Promise<{ articleId?: number | null; skipped?: boolean }>;
};

export function createJobId(slug: string, generatedAt = new Date()) {
  const timestamp = generatedAt.toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
  return `${timestamp}-${slug.replace(/[^a-z0-9-]/gi, "-").toLowerCase()}`;
}

export function idempotentObjectKey(slug: string, filePath: string, group: "cover" | "images") {
  return normalizeSlash(path.posix.join("articles", slug, group, path.basename(filePath)));
}

export function importJobManifestPath(jobId: string, dataDir = path.join(process.cwd(), "data", "import-jobs")) {
  return path.join(dataDir, `${jobId}.json`);
}

export function writeImportJobManifest(plan: ImportPlanV2, result?: ImportResult) {
  const filePath = importJobManifestPath(plan.jobId);
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${JSON.stringify({ plan, result }, null, 2)}\n`, "utf8");
  return filePath;
}

export function readImportJobManifest(jobId: string): { plan: ImportPlanV2; result?: ImportResult } {
  const filePath = importJobManifestPath(jobId);
  if (!existsSync(filePath)) throw new Error(`Import job manifest not found: ${filePath}`);
  return JSON.parse(readFileSync(filePath, "utf8")) as { plan: ImportPlanV2; result?: ImportResult };
}

export async function executeImportPlan(
  plan: ImportPlanV2,
  sourcePathsByObjectKey: Map<string, string>,
  executors: ImportExecutors,
): Promise<ImportResult> {
  const result = emptyImportResult(plan.jobId);

  try {
    for (const article of plan.articles) {
      for (const objectKey of article.r2ObjectKeys) {
        const sourcePath = sourcePathsByObjectKey.get(objectKey);
        if (!sourcePath) throw structuredImportError("missing-source", `Missing source path for ${objectKey}`, objectKey);
        await executors.putObject(objectKey, sourcePath);
        result.uploadedObjects.push(objectKey);
      }

      for (const sql of article.mediaInsertSql) {
        const write = await executors.executeSql(sql);
        if (write.skipped) result.skippedExistingObjects.push(sql);
        else result.createdDatabaseRows.push({ kind: "media_asset", key: article.slug });
      }

      const articleWrite = await executors.executeSql(article.articleInsertSql);
      result.articleIds.push({ slug: article.slug, id: articleWrite.articleId ?? null });
      if (!articleWrite.skipped) result.createdDatabaseRows.push({ kind: "article", key: article.slug });

      for (const sql of article.tagInsertSql) {
        await executors.executeSql(sql);
        result.createdDatabaseRows.push({ kind: "article_tag", key: article.slug });
      }
    }

    result.status = "success";
    result.rollbackStatus = "not-needed";
    return result;
  } catch (error) {
    result.errors.push(toImportError(error));
    const rollback = await rollbackImportPlan(plan, result, executors);
    result.rollbackStatus = rollback.rollbackStatus;
    result.status = rollback.rollbackStatus === "success" ? "rolled-back" : "rollback-failed";
    result.errors.push(...rollback.errors);
    return result;
  }
}

export async function rollbackImportPlan(plan: ImportPlanV2, result: ImportResult, executors: ImportExecutors): Promise<Pick<ImportResult, "errors" | "rollbackStatus">> {
  const errors: ImportError[] = [];

  for (const article of plan.articles.toReversed()) {
    for (const sql of article.rollbackSql.toReversed()) {
      try {
        await executors.executeSql(sql);
      } catch (error) {
        errors.push(toImportError(error, `rollback:${article.slug}`));
      }
    }
  }

  for (const objectKey of result.uploadedObjects.toReversed()) {
    try {
      await executors.deleteObject(objectKey);
    } catch (error) {
      errors.push(toImportError(error, `r2-delete:${objectKey}`));
    }
  }

  return {
    errors,
    rollbackStatus: errors.length === 0 ? "success" : result.uploadedObjects.length > 0 || plan.articles.length > 0 ? "partial" : "failed",
  };
}

export function emptyImportResult(jobId: string): ImportResult {
  return {
    jobId,
    status: "failed",
    articleIds: [],
    uploadedObjects: [],
    createdDatabaseRows: [],
    skippedExistingObjects: [],
    errors: [],
    rollbackStatus: "not-run",
  };
}

function structuredImportError(code: string, message: string, step?: string) {
  const error = new Error(message) as Error & { code?: string; step?: string };
  error.code = code;
  error.step = step;
  return error;
}

export function toImportError(error: unknown, step?: string): ImportError {
  if (error instanceof Error) {
    const extra = error as Error & { code?: string; step?: string };
    return {
      code: extra.code || "import-error",
      message: error.message,
      step: step || extra.step,
    };
  }

  return {
    code: "import-error",
    message: String(error),
    step,
  };
}
