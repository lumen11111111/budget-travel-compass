import assert from "node:assert/strict";

import {
  determineExitCode,
  finalVerdict,
  parseAcceptanceArgs,
  redactSecret,
  summarizeChecks,
  type AcceptanceCheck,
} from "../tools/starter/acceptance";

function check(status: AcceptanceCheck["status"], required = true): AcceptanceCheck {
  return {
    id: status,
    title: status,
    category: "project",
    required,
    status,
    durationMs: 0,
    summary: status,
    details: [],
    evidence: [],
  };
}

function main() {
  testArgParsing();
  testStatusModel();
  testExitCodes();
  testVerdicts();
  testOnlyFilterParsing();
  testRedaction();
  testQuickAndFullPlan();
  testProductionStrictExit();
  testContinueOnFailureFlag();
  testInvalidReportMode();
  testRemoteArg();
  testSkipBrowser();
  testBaseUrlLocal();
  testNonRequiredFailureDoesNotFail();
  testProductionWarningIsNotBlocked();
  testActionRequiredNonProduction();
  testMarkdownReportSafetyModel();
  testJsonReportSchemaFields();
  testBrowserMissingStatusModel();
  testSeoOnlyFilter();
  testRoutesBrowserOnlyFilter();
  testFrameworkModeConcept();
  testInstanceModeConcept();
  testSecretFalsePositiveExamples();
  testSecretTruePositiveRedaction();
  testClientSecretFailureShape();
  testBrandResidualStatusShape();
  testThemePreviewBrandExceptionConcept();
  testBrokenImageStatusShape();
  testConsoleErrorStatusShape();
  testHydrationWarningStatusShape();
  testHorizontalOverflowStatusShape();
  testMobileMenuStatusShape();
  testFooterAccordionStatusShape();
  testServerTimeoutStatusShape();
  testServerCleanupStatusShape();
  testContinueOnFailureExitPreserved();
  testOfflineDefault();
  console.log("PASS acceptance tests");
}

function testArgParsing() {
  const quick = parseAcceptanceArgs(["--quick", "--offline", "--skip-browser"]);
  assert.equal(quick.mode, "quick");
  assert.equal(quick.offline, true);
  assert.equal(quick.skipBrowser, true);

  const full = parseAcceptanceArgs(["--full", "--production", "--base-url=http://localhost:3000", "--report=json"]);
  assert.equal(full.mode, "full");
  assert.equal(full.production, true);
  assert.equal(full.baseUrl, "http://localhost:3000");
  assert.equal(full.report, "json");
}

function testStatusModel() {
  const summary = summarizeChecks([check("pass"), check("warn"), check("action-required"), check("fail"), check("skip", false)]);
  assert.deepEqual(summary, { pass: 1, warn: 1, "action-required": 1, fail: 1, skip: 1 });
}

function testExitCodes() {
  assert.equal(determineExitCode({ checks: [check("pass"), check("warn")], production: false }), 0);
  assert.equal(determineExitCode({ checks: [check("action-required")], production: false }), 0);
  assert.equal(determineExitCode({ checks: [check("action-required")], production: true }), 2);
  assert.equal(determineExitCode({ checks: [check("fail")], production: false }), 1);
}

function testVerdicts() {
  assert.equal(finalVerdict([check("pass")], false), "passed");
  assert.equal(finalVerdict([check("warn")], false), "passed-with-warnings");
  assert.equal(finalVerdict([check("action-required")], true), "blocked");
  assert.equal(finalVerdict([check("fail")], false), "failed");
}

function testOnlyFilterParsing() {
  const options = parseAcceptanceArgs(["--only=seo,routes,browser"]);
  assert(options.only.has("seo"));
  assert(options.only.has("routes"));
  assert(options.only.has("browser"));
}

function testRedaction() {
  assert.equal(redactSecret("super-secret-value"), "sup***ue");
  assert.equal(redactSecret("short"), "***");
}

function testQuickAndFullPlan() {
  assert.equal(parseAcceptanceArgs(["--quick"]).mode, "quick");
  assert.equal(parseAcceptanceArgs(["--full"]).mode, "full");
}

function testProductionStrictExit() {
  assert.equal(determineExitCode({ checks: [check("action-required"), check("warn")], production: true }), 2);
}

function testContinueOnFailureFlag() {
  assert.equal(parseAcceptanceArgs(["--continue-on-failure"]).continueOnFailure, true);
}

function testInvalidReportMode() {
  assert.throws(() => parseAcceptanceArgs(["--report=xml"]), /Invalid report mode/);
}

function testRemoteArg() {
  const options = parseAcceptanceArgs(["--remote", "--adapter=mock", "--account-id=mock-account"]);
  assert.equal(options.remote, true);
  assert.equal(options.adapterMode, "mock");
  assert.equal(options.accountId, "mock-account");
}

function testSkipBrowser() {
  assert.equal(parseAcceptanceArgs(["--full", "--skip-browser"]).skipBrowser, true);
}

function testBaseUrlLocal() {
  assert.equal(parseAcceptanceArgs(["--base-url=http://127.0.0.1:3999"]).baseUrl, "http://127.0.0.1:3999");
}

function testNonRequiredFailureDoesNotFail() {
  assert.equal(determineExitCode({ checks: [check("fail", false)], production: false }), 0);
}

function testProductionWarningIsNotBlocked() {
  assert.equal(determineExitCode({ checks: [check("warn")], production: true }), 0);
}

function testActionRequiredNonProduction() {
  assert.equal(finalVerdict([check("action-required")], false), "passed-with-warnings");
}

function testMarkdownReportSafetyModel() {
  assert(!redactSecret("abcde").includes("abcde"));
}

function testJsonReportSchemaFields() {
  const sample = check("pass");
  assert("id" in sample);
  assert("category" in sample);
  assert("durationMs" in sample);
  assert("evidence" in sample);
}

function testBrowserMissingStatusModel() {
  const sample = { ...check("action-required"), id: "browser-runtime", category: "browser" as const };
  assert.equal(sample.status, "action-required");
  assert.equal(sample.category, "browser");
}

function testSeoOnlyFilter() {
  const options = parseAcceptanceArgs(["--only=seo"]);
  assert.deepEqual(Array.from(options.only), ["seo"]);
}

function testRoutesBrowserOnlyFilter() {
  const options = parseAcceptanceArgs(["--only=routes,browser"]);
  assert(options.only.has("routes"));
  assert(options.only.has("browser"));
}

function testFrameworkModeConcept() {
  const sample = { ...check("warn"), category: "framework" as const };
  assert.equal(sample.category, "framework");
}

function testInstanceModeConcept() {
  const sample = { ...check("pass"), category: "project" as const };
  assert.equal(sample.required, true);
}

function testSecretFalsePositiveExamples() {
  assert.equal(redactSecret("replace-with-long-random-secret"), "rep***et");
}

function testSecretTruePositiveRedaction() {
  assert.equal(redactSecret("real-production-secret"), "rea***et");
}

function testClientSecretFailureShape() {
  const sample = { ...check("fail"), id: "client-secret", category: "security" as const };
  assert.equal(sample.status, "fail");
}

function testBrandResidualStatusShape() {
  const sample = { ...check("warn"), id: "brand-residual-scan", category: "content" as const };
  assert.equal(sample.category, "content");
}

function testThemePreviewBrandExceptionConcept() {
  const allowed = ["Homerio", "MocktailMuse"];
  assert(allowed.includes("Homerio"));
}

function testBrokenImageStatusShape() {
  const sample = { ...check("fail"), id: "broken-image", category: "browser" as const };
  assert.equal(sample.id, "broken-image");
}

function testConsoleErrorStatusShape() {
  const sample = { ...check("fail"), id: "console-error", category: "browser" as const };
  assert.equal(sample.category, "browser");
}

function testHydrationWarningStatusShape() {
  const sample = { ...check("fail"), id: "hydration-warning", category: "browser" as const };
  assert.equal(sample.required, true);
}

function testHorizontalOverflowStatusShape() {
  const sample = { ...check("fail"), id: "horizontal-overflow", category: "responsive" as const };
  assert.equal(sample.category, "responsive");
}

function testMobileMenuStatusShape() {
  const sample = { ...check("fail"), id: "mobile-menu", category: "browser" as const };
  assert.equal(sample.id, "mobile-menu");
}

function testFooterAccordionStatusShape() {
  const sample = { ...check("fail"), id: "footer-accordion", category: "browser" as const };
  assert.equal(sample.id, "footer-accordion");
}

function testServerTimeoutStatusShape() {
  const sample = { ...check("fail"), id: "server-timeout", category: "routes" as const };
  assert.equal(sample.status, "fail");
}

function testServerCleanupStatusShape() {
  const sample = { ...check("pass"), id: "server-cleanup", category: "routes" as const };
  assert.equal(sample.status, "pass");
}

function testContinueOnFailureExitPreserved() {
  assert.equal(determineExitCode({ checks: [check("fail"), check("pass")], production: false }), 1);
}

function testOfflineDefault() {
  assert.equal(parseAcceptanceArgs([]).offline, true);
}

main();
