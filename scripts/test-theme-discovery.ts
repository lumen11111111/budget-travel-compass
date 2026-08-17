import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { discoverTheme, discoverThemes } from "../tools/starter/theme-discovery";

const themes = discoverThemes(process.cwd());
const keys = themes.map((theme) => theme.key);

assert(keys.includes("homerio"), "built-in homerio theme must be discoverable");
assert(keys.includes("freeze-fixture"), "disposable freeze fixture theme must be discoverable from frontend-library/*/theme.json");

const fixture = discoverTheme("freeze-fixture", process.cwd());
assert(fixture, "freeze fixture theme must resolve by key");
assert.equal(fixture.definition.package, "@contentforge/theme-freeze-fixture");
assert.equal(fixture.definition.libraryPath, "frontend-library/freeze-fixture");
assert(fixture.manifest.layouts.homepage, "fixture homepage layout must be read from manifest");
assert(fixture.manifest.components.articleCard, "fixture article card must be read from manifest");

const registrySource = readFileSync("src/theme/registry.ts", "utf8");
const factorySource = readFileSync("tools/factory/create-instance.ts", "utf8");
const createSiteSource = readFileSync("tools/starter/create-site.ts", "utf8");

assert(!registrySource.includes("freeze-fixture:"), "new themes must not be hardcoded in src/theme/registry.ts");
assert(!factorySource.includes("supportedThemes"), "factory must not keep a hardcoded supportedThemes list");
assert(createSiteSource.includes("discoverThemes"), "create-site must use theme discovery");
assert(factorySource.includes("requiredTheme"), "create-instance must use theme discovery");

console.log("PASS theme discovery tests");
