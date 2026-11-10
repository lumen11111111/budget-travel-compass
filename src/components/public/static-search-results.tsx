"use client";

import { useEffect, useState } from "react";
import { ArticleCard } from "@/components/public/article-card";
import { GuidesEmptyState } from "@/components/public/inner-page";
import { filterStaticSearchArticles, type StaticSearchArticle } from "@/lib/static-search";

export function StaticSearchResults({ defaultAuthor }: { defaultAuthor: string }) {
  const [query, setQuery] = useState("");
  const [articles, setArticles] = useState<StaticSearchArticle[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setQuery(new URLSearchParams(window.location.search).get("q")?.trim() ?? "");
    const controller = new AbortController();
    fetch("/search-index.json", { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Search index returned ${response.status}.`);
        return response.json() as Promise<StaticSearchArticle[]>;
      })
      .then(setArticles)
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setFailed(true);
      });
    return () => controller.abort();
  }, []);

  const results = articles ? filterStaticSearchArticles(articles, query) : [];
  const title = query ? `Search results: ${query}` : "All travel guides";

  return (
    <section>
      <div className="section-title" style={{ marginTop: 0 }}>
        <div><span className="eyebrow">Search results</span><h2>{title}</h2></div>
        <span>{articles ? `${results.length} results` : "Loading…"}</span>
      </div>
      {failed ? <p>Search is temporarily unavailable. Browse all guides instead.</p> : null}
      {!failed && articles && results.length === 0 ? <GuidesEmptyState search /> : null}
      {!failed && articles && results.length > 0 ? (
        <div className="article-list">
          {results.map((article) => <ArticleCard article={article} defaultAuthor={defaultAuthor} key={article.id} />)}
        </div>
      ) : null}
    </section>
  );
}
