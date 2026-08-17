const allowedTags = new Set([
  "a",
  "blockquote",
  "br",
  "caption",
  "figcaption",
  "figure",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "img",
  "li",
  "ol",
  "p",
  "strong",
  "em",
  "span",
  "table",
  "tbody",
  "td",
  "th",
  "thead",
  "tr",
  "ul",
]);

const allowedAttributes = new Set(["alt", "class", "colspan", "href", "rel", "rowspan", "src", "style", "target", "title"]);
const preservedComplexTags = ["table", "figure"] as const;

export function sanitizeArticleHtml(input: string) {
  return input
    .replace(/<\s*(script|iframe)\b[\s\S]*?<\s*\/\s*\1\s*>/gi, "")
    .replace(/<\s*(script|iframe)\b[^>]*\/?\s*>/gi, "")
    .replace(/<\/?([a-z0-9-]+)([^>]*)>/gi, (match, rawTag: string, rawAttrs: string) => {
      const tag = rawTag.toLowerCase();
      const isClosing = /^<\s*\//.test(match);
      if (!allowedTags.has(tag)) return "";
      if (isClosing) return `</${tag}>`;
      const attrs = sanitizeAttributes(rawAttrs || "", tag);
      return `<${tag}${attrs}>`;
    })
    .trim();
}

export function preserveImportedArticleHtml(submittedHtml: string, originalHtml: string) {
  const sanitizedSubmitted = sanitizeArticleHtml(submittedHtml);
  const sanitizedOriginal = sanitizeArticleHtml(originalHtml);
  if (!sanitizedOriginal) return sanitizedSubmitted;

  let output = sanitizedSubmitted;
  for (const tag of preservedComplexTags) {
    if (containsTag(sanitizedOriginal, tag) && !containsTag(output, tag)) {
      output = `${output}\n${extractBlocks(sanitizedOriginal, tag).join("\n")}`.trim();
    }
  }

  if (containsTag(sanitizedOriginal, "figcaption") && !containsTag(output, "figcaption")) {
    output = `${output}\n${extractBlocks(sanitizedOriginal, "figure").join("\n")}`.trim();
  }

  return output;
}

export function articleHtmlWhitelist() {
  return {
    tags: [...allowedTags].sort(),
    attributes: [...allowedAttributes].sort(),
    blockedTags: ["script", "iframe"],
    blockedAttributePrefixes: ["on"],
  };
}

function containsTag(html: string, tag: string) {
  return new RegExp(`<${tag}(\\s|>|/)`, "i").test(html);
}

function extractBlocks(html: string, tag: string) {
  const blocks: string[] = [];
  const pattern = new RegExp(`<${tag}\\b[\\s\\S]*?<\\/${tag}>`, "gi");
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(html)) !== null) {
    blocks.push(match[0]);
  }
  return blocks;
}

function sanitizeAttributes(rawAttrs: string, tag: string) {
  const attrs: string[] = [];
  const pattern = /([:@a-zA-Z0-9_-]+)(?:\s*=\s*("[^"]*"|'[^']*'|[^\s"'>]+))?/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(rawAttrs)) !== null) {
    const name = match[1].toLowerCase();
    const rawValue = match[2] ?? "";
    const value = rawValue.replace(/^['"]|['"]$/g, "");
    if (name.startsWith("on") || !allowedAttributes.has(name)) continue;
    if ((name === "href" || name === "src") && !isSafeUrl(value)) continue;
    if (name === "style" && !isSafeStyle(value)) continue;
    if (tag === "a" && name === "target" && value !== "_blank") continue;
    attrs.push(`${name}="${escapeAttribute(value)}"`);
  }

  if (tag === "a" && attrs.some((attr) => attr.startsWith("target=")) && !attrs.some((attr) => attr.startsWith("rel="))) {
    attrs.push('rel="noopener noreferrer"');
  }

  return attrs.length ? ` ${attrs.join(" ")}` : "";
}

function isSafeUrl(value: string) {
  const trimmed = value.trim();
  return /^(https?:|\/|#|mailto:)/i.test(trimmed) && !/^javascript:/i.test(trimmed);
}

function isSafeStyle(value: string) {
  return !/expression|javascript:|url\s*\(/i.test(value);
}

function escapeAttribute(value: string) {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}
