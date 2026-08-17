import crypto from "node:crypto";

import type { BootstrapConfigInput } from "./production-bootstrap";

export function generateIntegrationPrefix(now = new Date()) {
  const stamp = now.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "z").toLowerCase();
  return `contentforge-it-${stamp}-${crypto.randomBytes(3).toString("hex")}`;
}

export function integrationResourceNames(prefix: string) {
  return {
    workerName: prefix,
    d1Name: prefix,
    r2Name: `${prefix}-media`,
    operationMarker: prefix,
  };
}

export function validateIntegrationPrefix(prefix: string, config?: BootstrapConfigInput) {
  const errors: string[] = [];
  if (!prefix) errors.push("resource prefix is required");
  if (!prefix.startsWith("contentforge-it-")) errors.push("resource prefix must start with contentforge-it-");
  if (!/^[a-z0-9-]+$/.test(prefix)) errors.push("resource prefix must use lowercase letters, digits, and hyphens only");
  if (/^-|-$/.test(prefix)) errors.push("resource prefix cannot start or end with a hyphen");
  if (prefix.length < 18 || prefix.length > 52) errors.push("resource prefix length must be between 18 and 52 characters");

  const names = integrationResourceNames(prefix);
  const r2Errors = validateR2BucketName(names.r2Name);
  errors.push(...r2Errors);

  const denied = productionDenylist(config);
  for (const name of [names.workerName, names.d1Name, names.r2Name]) {
    if (denied.has(name)) errors.push(`resource name collides with protected production name: ${name}`);
  }

  return errors;
}

export function validateR2BucketName(name: string) {
  const errors: string[] = [];
  if (name.length < 3 || name.length > 63) errors.push("R2 bucket name must be 3 to 63 characters");
  if (!/^[a-z0-9-]+$/.test(name)) errors.push("R2 bucket name must use lowercase letters, digits, and hyphens only");
  if (/^-|-$/.test(name)) errors.push("R2 bucket name cannot start or end with a hyphen");
  return errors;
}

export function productionDenylist(config?: BootstrapConfigInput) {
  return new Set(
    [
      "aroma-haven",
      "aroma-haven-media",
      "wellness-note",
      config?.workerName,
      config?.d1DatabaseName,
      config?.d1DatabaseId,
      config?.r2BucketName,
      config?.customDomain,
      config?.siteSlug,
    ]
      .filter((value): value is string => Boolean(value))
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean),
  );
}

