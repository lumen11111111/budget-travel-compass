export function normalizeArticleBodyHtml(html: string): string {
  if (!html) return html;

  let headingIndex = 0;
  return html
    .replace(/<\s*h1\b([^>]*)>/gi, "<h2$1>")
    .replace(/<\s*\/\s*h1\s*>/gi, "</h2>")
    .replace(/<table\b([^>]*)>/gi, '<div class="article-table-scroll" role="region" aria-label="Scrollable data table" tabindex="0"><table$1>')
    .replace(/<\/table>/gi, "</table></div>")
    .replace(/<h([23])([^>]*)>([\s\S]*?)<\/h\1>/gi, (_match, level, attrs, content) => {
      const idMatch = String(attrs).match(/\sid=["']([^"']+)["']/i);
      const id = idMatch?.[1] ?? `guide-section-${++headingIndex}`;
      return `<h${level}${attrs}${idMatch ? "" : ` id="${id}"`}>${content}</h${level}>`;
    });
}

export function listArticleHeadings(html: string) {
  return Array.from(html.matchAll(/<h([23])[^>]*id=["']([^"']+)["'][^>]*>([\s\S]*?)<\/h\1>/gi)).map((match) => ({
    id: match[2],
    level: Number(match[1]),
    text: match[3].replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").trim(),
  }));
}
