import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

type Finding = {
  classification: "allowed-global" | "framework-global" | "theme-global-risk" | "component-scoped";
  file: string;
  line: number;
  selector: string;
};

const root = process.cwd();
const themesDir = path.join(root, "frontend-library");
const themePrefixes: Record<string, string[]> = {
  "botanical-editorial": ["botanical-", "be-"],
  homerio: ["hm-", "home-", "site-", "article-", "category-", "newspaper-", "featured-", "latest-", "related-"],
  mocktailmuse: ["mocktail-", "mm-", "site-", "article-", "category-", "newspaper-", "featured-", "latest-", "related-"],
  "wellness-editorial": ["wellness-", "we-", "site-", "article-", "category-", "newspaper-", "featured-", "latest-", "related-"],
};

const allowedGlobals = new Set([":root", "html", "body", "*", "*,", "a", "img"]);
const frameworkGlobals = new Set(["container", "button", "site-shell", "article-body", "pagination"]);
const highRisk = new Set(["card", "hero", "footer", "header", "tag", "newsletter", "search-result"]);
// Historical brand leakage detector: these selectors must never appear in reusable Theme CSS.
const legacyLeakSelectorPattern = /\.(aroma|wellness-note|questfiction|health-site)\b/i;
const absolutePathPattern = /(?:[A-Z]:\\|\/Users\/|\/home\/)/;

function main() {
  const findings: Finding[] = [];
  const failures: string[] = [];

  for (const theme of readdirSync(themesDir)) {
    const stylesDir = path.join(themesDir, theme, "styles");
    if (!existsSync(stylesDir) || !statSync(stylesDir).isDirectory()) continue;
    for (const file of walkCss(stylesDir)) {
      const relative = path.relative(root, file).replace(/\\/g, "/");
      const text = readFileSync(file, "utf8");
      const lines = text.split(/\r?\n/);
      lines.forEach((line, index) => {
        if (legacyLeakSelectorPattern.test(line)) failures.push(`${relative}:${index + 1} contains instance brand selector.`);
        if (absolutePathPattern.test(line)) failures.push(`${relative}:${index + 1} contains absolute path.`);

        const selectorMatch = line.match(/^\s*([^@{}][^{]+)\s*\{/);
        if (!selectorMatch) return;
        for (const selector of selectorMatch[1].split(",")) {
          const trimmed = selector.trim();
          const className = trimmed.match(/\.([A-Za-z0-9_-]+)/)?.[1];
          if (!className) {
            if (allowedGlobals.has(trimmed)) findings.push({ classification: "allowed-global", file: relative, line: index + 1, selector: trimmed });
            continue;
          }

          const classification = classifySelector(theme, className);
          findings.push({ classification, file: relative, line: index + 1, selector: trimmed });
          if (classification === "theme-global-risk") failures.push(`${relative}:${index + 1} ${trimmed}`);
        }
      });
    }
  }

  const grouped = findings.reduce<Record<string, number>>((acc, finding) => {
    acc[finding.classification] = (acc[finding.classification] ?? 0) + 1;
    return acc;
  }, {});

  console.log("Theme CSS audit");
  console.log(JSON.stringify(grouped, null, 2));
  if (failures.length > 0) {
    console.log("");
    console.log("Failures:");
    for (const failure of failures.slice(0, 50)) console.log(`- ${failure}`);
    process.exitCode = 1;
    return;
  }

  console.log("0 fail, 0 error");
}

function classifySelector(theme: string, className: string): Finding["classification"] {
  if (themePrefixes[theme]?.some((prefix) => className.startsWith(prefix))) return "component-scoped";
  if (frameworkGlobals.has(className)) return "framework-global";
  if (highRisk.has(className)) return "theme-global-risk";
  return "component-scoped";
}

function walkCss(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir)) {
    const fullPath = path.join(dir, entry);
    if (statSync(fullPath).isDirectory()) files.push(...walkCss(fullPath));
    else if (entry.endsWith(".css")) files.push(fullPath);
  }
  return files;
}

main();
