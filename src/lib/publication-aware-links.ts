import render from "dom-serializer";
import { parseDocument } from "htmlparser2";
import type { AnyNode, Element, ParentNode } from "domhandler";

const INTERNAL_ARTICLE_HREF = /^\/news\/([a-z0-9]+(?:-[a-z0-9]+)*)$/;

export type PublishedArticleSlugResolver = (slugs: readonly string[]) => Promise<ReadonlySet<string>>;

export function extractInternalArticleSlugs(html: string): string[] {
  const document = parseDocument(html);
  const slugs = new Set<string>();

  walk(document.children, (node) => {
    if (!isAnchor(node)) return;
    const slug = internalArticleSlug(node.attribs.href);
    if (slug) slugs.add(slug);
  });

  return [...slugs];
}

export function filterUnpublishedInternalArticleLinks(html: string, publishedSlugs: ReadonlySet<string>): string {
  const document = parseDocument(html);

  walk(document.children, (node) => {
    if (!isAnchor(node)) return;
    const slug = internalArticleSlug(node.attribs.href);
    if (!slug || publishedSlugs.has(slug)) return;
    unwrapElement(node);
  });

  return render(document.children);
}

export async function renderPublicationAwareArticleHtml(
  html: string,
  resolvePublishedSlugs: PublishedArticleSlugResolver,
): Promise<string> {
  const targetSlugs = extractInternalArticleSlugs(html);
  if (targetSlugs.length === 0) return html;

  try {
    const publishedSlugs = await resolvePublishedSlugs(targetSlugs);
    return filterUnpublishedInternalArticleLinks(html, publishedSlugs);
  } catch (error) {
    console.error("Publication-aware internal-link lookup failed; rendering article links as plain text.", error);
    return filterUnpublishedInternalArticleLinks(html, new Set());
  }
}

function internalArticleSlug(href: string | undefined) {
  return href?.match(INTERNAL_ARTICLE_HREF)?.[1] ?? null;
}

function isAnchor(node: AnyNode): node is Element {
  return node.type === "tag" && node.name === "a";
}

function walk(nodes: AnyNode[], visit: (node: AnyNode) => void) {
  for (const node of [...nodes]) {
    visit(node);
    if ("children" in node) walk(node.children, visit);
  }
}

function unwrapElement(element: Element) {
  const parent = element.parent as ParentNode | null;
  if (!parent || !("children" in parent)) return;

  const index = parent.children.indexOf(element);
  if (index < 0) return;

  for (const child of element.children) child.parent = parent;
  parent.children.splice(index, 1, ...element.children);
  element.children = [];
  element.parent = null;
}
