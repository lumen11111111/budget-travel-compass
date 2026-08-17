import Link from "next/link";
import "../styles/index.css";
import { EditorialArticleCard } from "../components/EditorialArticleCard";
import { HomeCategoryCard } from "../components/HomeCategoryCard";
import { Pagination, PaginationSummary } from "../components/Pagination";
import { ArticlePageLayout } from "../layouts/ArticlePageLayout";
import { CategoryPageLayout } from "../layouts/CategoryPageLayout";
import { HomepageLayout } from "../layouts/HomepageLayout";
import { SearchPageLayout } from "../layouts/SearchPageLayout";
import { FooterShell } from "../shell/FooterShell";
import { HeaderShell } from "../shell/HeaderShell";
import { SearchPanelShell } from "../shell/SearchPanelShell";
import { SidebarShell } from "../shell/SidebarShell";
import {
  previewArticles,
  previewBrand,
  previewCategories,
  previewLegalLinks,
  previewNavigation,
  previewTags,
  previewUtilityLinks,
  type PreviewArticle,
  type PreviewCategory,
} from "./preview-data";

export default function BotanicalEditorialThemePreview() {
  const header = <PreviewHeader />;
  const footer = <PreviewFooter />;
  const sidebar = (
    <SidebarShell
      tags={previewTags}
      editorPicks={previewArticles.slice(0, 4).map((article) => ({
        title: article.title,
        href: article.href,
        meta: article.readingTime,
      }))}
      labels={{ popularTags: "Popular Topics", editorPicks: "Editor Picks" }}
    />
  );

  return (
    <div>
      <HomepageLayout<PreviewArticle, PreviewCategory>
        hero={{
          image: previewArticles[0].image,
          label: "Theme Preview",
          title: previewBrand.siteName,
          subtitle: previewBrand.tagline,
          note: "Educational. Reference-led. Calmly structured.",
          cta: { label: "Start Reading", href: "#preview-article" },
          header,
        }}
        categories={previewCategories}
        featuredArticles={previewArticles.slice(0, 1)}
        latestArticles={previewArticles.slice(1, 7)}
        categoryShowcase={{ title: "Explore by Topic" }}
        featuredSection={{ title: "Featured Article" }}
        latestSection={{ id: "latest", title: "Latest Articles", deck: "Latest published items appear here.", href: "/news", linkLabel: "View all articles ->" }}
        newsletter={{ title: "Stay in the Loop", description: "A neutral newsletter shell for instance-provided copy.", inputPlaceholder: "Your email address", buttonLabel: "Subscribe", disabled: true }}
        footer={footer}
        renderArticleCard={(article, context) => <PreviewArticleCard article={article} {...context} />}
        renderCategoryCard={(category) => <HomeCategoryCard title={category.title} href={category.href} description={category.description} image={category.image} />}
      />

      <div id="preview-article">
        <ArticlePageLayout<PreviewArticle>
          header={header}
          footer={footer}
          breadcrumb={<PreviewBreadcrumb />}
          articleHero={
            <header className="article-hero">
              <div className="article-hero-content">
                <span className="eyebrow">{previewArticles[0].category.label}</span>
                <h1>{previewArticles[0].title}</h1>
                <p>{previewArticles[0].excerpt}</p>
                <div className="meta">
                  <span>{previewArticles[0].date.label}</span>
                  <span>{previewArticles[0].author}</span>
                  <span>{previewArticles[0].readingTime}</span>
                </div>
              </div>
              <img className="cover" src={previewArticles[0].image.src} alt={previewArticles[0].image.alt} />
            </header>
          }
          articleBody={<PreviewArticleBody />}
          relatedArticles={previewArticles.slice(1, 4)}
          renderRelatedArticleCard={(article, context) => <PreviewArticleCard article={article} {...context} />}
        />
      </div>

      <CategoryPageLayout<PreviewArticle>
        header={header}
        footer={footer}
        hero={{ eyebrow: "Category", title: "Botanical Oils", description: "Category hero with count, filters, image, cards, pagination, and empty state.", countLabel: "7 guides", image: previewCategories[1].image }}
        searchPanel={{ action: "/search", query: "", placeholder: "Search this category", buttonLabel: "Search" }}
        articles={previewArticles}
        sidebar={sidebar}
        pagination={<><PaginationSummary currentPage={1} totalPages={2} totalItems={7} pageSize={6} /><Pagination currentPage={1} totalPages={2} getPageHref={(page) => `/category/botanical-oils?page=${page}`} /></>}
        renderArticleCard={(article, context) => <PreviewArticleCard article={article} {...context} />}
      />

      <SearchPageLayout<PreviewArticle>
        header={header}
        footer={footer}
        searchPanel={{ action: "/search", query: "floral", placeholder: "Search botanical guides", buttonLabel: "Search" }}
        eyebrow="Search"
        title="Search Results"
        resultCountLabel="4 results"
        articles={previewArticles.slice(0, 4)}
        sidebar={sidebar}
        emptyState="No matching guides yet."
        renderArticleCard={(article, context) => <PreviewArticleCard article={article} {...context} />}
      />

      <section className="site-shell">
        <PreviewHeader />
        <div className="botanical-page-section">
          <div className="empty-state">
            <h2>Empty Category</h2>
            <p>This demonstrates the no-results state used by category and search pages.</p>
          </div>
          <section className="botanical-contact-card">
            <div>
              <span className="eyebrow">Contact</span>
              <h2>Editorial, privacy, and general questions</h2>
              <p>Contact shell with fields, note, and disabled submission state.</p>
            </div>
            <form className="botanical-contact-form">
              <label>Name<input name="name" /></label>
              <label>Email<input name="email" type="email" /></label>
              <label>Subject<input name="subject" /></label>
              <label>Message<textarea name="message" rows={5} /></label>
              <button type="button" aria-disabled="true">Contact Form Coming Soon</button>
              <p className="botanical-form-note">Success and error messages can be injected by the instance mail provider.</p>
            </form>
          </section>
          <section className="legal-document">
            <header className="legal-document-header">
              <span className="eyebrow">Legal</span>
              <h1>Policy Page Shell</h1>
              <p>Reusable legal layout for privacy, terms, disclaimer, and editorial policy pages.</p>
            </header>
            <section className="legal-section"><h2>Policy Section</h2><p>Instance legal text is supplied outside the theme.</p></section>
          </section>
        </div>
        <PreviewFooter />
      </section>

      <section className="botanical-page-hero botanical-not-found-hero">
        <div className="botanical-page-hero-copy">
          <span className="eyebrow">404</span>
          <h1>Page Not Found</h1>
          <p>Reusable not-found shell with action links.</p>
          <div className="botanical-action-row">
            <Link className="botanical-primary-link" href="/">Back to Home</Link>
            <Link className="botanical-outline-link botanical-outline-link-dark" href="/search">Search</Link>
          </div>
        </div>
      </section>

      <section className="botanical-page-section">
        <SearchPanelShell action="/search" query="" placeholder="Standalone search panel" buttonLabel="Search" />
      </section>
    </div>
  );
}

function PreviewHeader() {
  return <HeaderShell logo={{ suffix: previewBrand.siteName, href: "/" }} primaryNavigation={previewNavigation} utilityLinks={previewUtilityLinks} searchHref="/search" searchLabel="Search Botanical Journal" />;
}

function PreviewFooter() {
  return <FooterShell logo={{ suffix: previewBrand.siteName, href: "/" }} description={previewBrand.tagline} categoryLinks={previewNavigation} companyLinks={previewUtilityLinks} legalLinks={previewLegalLinks} copyright="Copyright 2026 Botanical Journal Theme Preview." legalIdentity={["Theme preview only", "No production data"]} />;
}

function PreviewArticleCard({ article, variant, priorityImage = false }: { article: PreviewArticle; variant: "feature" | "standard" | "compact"; priorityImage?: boolean }) {
  return <EditorialArticleCard title={article.title} href={article.href} excerpt={article.excerpt} image={article.image} category={article.category} date={article.date} readingTime={article.readingTime} author={article.author} variant={variant} priorityImage={priorityImage} />;
}

function PreviewBreadcrumb() {
  return <nav className="botanical-breadcrumb" aria-label="Breadcrumb"><ol><li><Link href="/">Home</Link></li><li><Link href="/category/guides">Guides</Link></li><li aria-current="page">Preview Article</li></ol></nav>;
}

function PreviewArticleBody() {
  return (
    <div className="article-body">
      <p>This neutral preview body demonstrates typography, reading width, source blocks, safety notes, tables, figures, captions, lists, and long-link handling.</p>
      <h2>Start with a reference note</h2>
      <p>Use the article shell for educational content. The instance supplies real article HTML from CMS or import pipelines.</p>
      <h3>Checklist</h3>
      <ul><li>Confirm context before use.</li><li>Keep concentrated materials clearly labeled.</li><li>Record sources for review.</li></ul>
      <blockquote>Preview blockquote treatment for editorial emphasis.</blockquote>
      <figure><img src={previewArticles[2].image.src} alt={previewArticles[2].image.alt} /><figcaption>Figure caption style for inline media.</figcaption></figure>
      <table><tbody><tr><th>Item</th><th>Purpose</th></tr><tr><td>Notebook</td><td>Observations</td></tr></tbody></table>
      <section className="botanical-safety-note"><h2>Safety Note</h2><p>Theme shell only. Instance content controls the actual notice text.</p></section>
      <div className="tag-row">{previewTags.map((tag) => <Link className="tag" href={tag.href} key={tag.href}>{tag.label}</Link>)}</div>
    </div>
  );
}
