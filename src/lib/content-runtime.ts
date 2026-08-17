import { siteConfig } from "@/config/site.config";

export type ContentRuntimeMode = "preview" | "fallback" | "production";

export type ContentRuntimeDecision = {
  allowProductionFallback: boolean;
  mode: ContentRuntimeMode;
  reason: string;
};

export function getAllowProductionFallback() {
  const env = process.env.CONTENTFORGE_ALLOW_PRODUCTION_FALLBACK;
  if (env === "1" || env === "true") return true;
  if (env === "0" || env === "false") return false;

  const configured = readRuntimeConfigBoolean("allowProductionFallback");
  if (typeof configured === "boolean") return configured;

  return process.env.NODE_ENV !== "production";
}

export function decideContentRuntime(hasDatabase: boolean): ContentRuntimeDecision {
  if (hasDatabase) {
    return {
      allowProductionFallback: getAllowProductionFallback(),
      mode: "production",
      reason: "D1 database is available.",
    };
  }

  const allowProductionFallback = getAllowProductionFallback();
  return {
    allowProductionFallback,
    mode: allowProductionFallback ? "fallback" : "production",
    reason: allowProductionFallback ? "D1 unavailable and fallback is enabled." : "D1 unavailable and fallback is disabled.",
  };
}

export function previewRuntimeDecision(): ContentRuntimeDecision {
  return {
    allowProductionFallback: true,
    mode: "preview",
    reason: "Theme preview route uses isolated preview data.",
  };
}

function readRuntimeConfigBoolean(key: "allowProductionFallback") {
  const runtime = (siteConfig as unknown as { runtime?: Record<string, unknown> }).runtime;
  const value = runtime?.[key];
  return typeof value === "boolean" ? value : undefined;
}
