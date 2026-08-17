import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";

type FrameworkVersion = {
  version?: string;
};

const frameworkVersion = JSON.parse(readFileSync("framework.version.json", "utf8")) as FrameworkVersion;
assert.equal(typeof frameworkVersion.version, "string", "framework.version.json must define version");
assert.notEqual(frameworkVersion.version?.trim(), "", "framework.version.json version must be non-empty");

if (existsSync(".contentforge-version")) {
  const instanceVersion = readFileSync(".contentforge-version", "utf8").trim();
  assert.equal(instanceVersion, frameworkVersion.version, ".contentforge-version must match framework.version.json in Framework root");
}

const packageJson = JSON.parse(readFileSync("package.json", "utf8")) as { version?: string };
assert.equal(packageJson.version, "0.1.0", "package.json keeps package semantics and is not the Framework release source");

const tagsAtHead = execFileSync("git", ["tag", "--points-at", "HEAD"], { encoding: "utf8" })
  .split(/\r?\n/)
  .map((line) => line.trim())
  .filter(Boolean);
const releaseTags = tagsAtHead.filter((tag) => /^v\d+\.\d+\.\d+/.test(tag));
for (const tag of releaseTags) {
  assert.equal(tag, `v${frameworkVersion.version}`, `release tag ${tag} must match framework.version.json`);
}

console.log("PASS framework version contract tests");
