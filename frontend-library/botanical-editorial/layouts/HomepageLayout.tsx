import { Fragment, type ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { Mail } from "lucide-react";

type ThemeImage = {
  src: string;
  alt: string;
};

type ThemeLink = {
  label: ReactNode;
  href: string;
};

export type HomepageLayoutProps<TArticle, TCategory> = {
  hero: {
    image: ThemeImage;
    label?: ReactNode;
    title: ReactNode;
    subtitle?: ReactNode;
    cta?: ThemeLink;
    header?: ReactNode;
    note?: ReactNode;
  };
  categories: readonly TCategory[];
  featuredArticles: readonly TArticle[];
  latestArticles: readonly TArticle[];
  categoryShowcase: {
    title: ReactNode;
    deck?: ReactNode;
  };
  featuredSection: {
    title: ReactNode;
    deck?: ReactNode;
  };
  latestSection: {
    id?: string;
    title: ReactNode;
    deck?: ReactNode;
    href?: string;
    linkLabel?: ReactNode;
  };
  newsletter?: {
    title: ReactNode;
    description?: ReactNode;
    inputPlaceholder?: string;
    buttonLabel?: ReactNode;
    disabled?: boolean;
  };
  footer?: ReactNode;
  renderArticleCard: (
    article: TArticle,
    context: { index: number; variant: "feature" | "standard" | "compact"; priorityImage: boolean },
  ) => ReactNode;
  renderCategoryCard: (category: TCategory, context: { index: number; layout: "portrait" | "landscape" }) => ReactNode;
};

export function HomepageLayout<TArticle, TCategory>({
  hero,
  categories,
  featuredArticles,
  latestArticles,
  categoryShowcase,
  featuredSection,
  latestSection,
  newsletter,
  footer,
  renderArticleCard,
  renderCategoryCard,
}: HomepageLayoutProps<TArticle, TCategory>) {
  const featured = featuredArticles[0];

  return (
    <main className="botanical-home">
      <section className="botanical-hero" aria-label="Site introduction">
        {hero.header}
        <div className="botanical-hero-grid">
          <div className="botanical-hero-copy">
            {hero.label ? <p className="botanical-section-label">{hero.label}</p> : null}
            <h1>{hero.title}</h1>
            {hero.subtitle ? <p>{hero.subtitle}</p> : null}
          </div>
          <div className="botanical-hero-product">
            <Image src={hero.image.src} alt={hero.image.alt} fill priority sizes="(max-width: 767px) 86vw, 52vw" />
          </div>
          {hero.note ? <p className="botanical-hero-note">{hero.note}</p> : null}
        </div>
        {hero.cta ? (
          <Link className="botanical-hero-cta" href={hero.cta.href}>
            {hero.cta.label}
          </Link>
        ) : null}
      </section>

      <section className="botanical-section botanical-topics" aria-labelledby="botanical-topics-title">
        <div className="botanical-section-inner">
          <h2 id="botanical-topics-title">{categoryShowcase.title}</h2>
          <div className="botanical-topic-grid" tabIndex={0}>
            {categories.map((category, index) => (
              <Fragment key={index}>{renderCategoryCard(category, { index, layout: "portrait" })}</Fragment>
            ))}
          </div>
        </div>
      </section>

      <section className="botanical-section botanical-featured" aria-labelledby="botanical-featured-title">
        <div className="botanical-section-inner botanical-featured-grid">
          <article className="botanical-featured-copy">
            <p className="botanical-section-label" id="botanical-featured-title">
              {featuredSection.title}
            </p>
            {featured ? renderArticleCard(featured, { index: 0, variant: "feature", priorityImage: true }) : <EmptyState text={featuredSection.deck} />}
          </article>
        </div>
      </section>

      <section className="botanical-section botanical-latest" aria-labelledby={latestSection.id ?? "botanical-latest-title"}>
        <div className="botanical-section-inner">
          <div className="botanical-section-row">
            <h2 id={latestSection.id ?? "botanical-latest-title"}>{latestSection.title}</h2>
            {latestSection.href ? <Link href={latestSection.href}>{latestSection.linkLabel}</Link> : null}
          </div>
          {latestArticles.length > 0 ? (
            <div className="botanical-latest-grid">
              {latestArticles.map((article, index) =>
                <Fragment key={index}>{renderArticleCard(article, { index, variant: "compact", priorityImage: false })}</Fragment>,
              )}
            </div>
          ) : (
            <EmptyState text={latestSection.deck} />
          )}
        </div>
      </section>

      {newsletter ? (
        <section className="botanical-section botanical-newsletter" aria-labelledby="botanical-newsletter-title">
          <div className="botanical-section-inner botanical-newsletter-inner">
            <div className="botanical-newsletter-icon" aria-hidden="true">
              <Mail size={34} />
            </div>
            <div>
              <h2 id="botanical-newsletter-title">{newsletter.title}</h2>
              {newsletter.description ? <p>{newsletter.description}</p> : null}
            </div>
            <form className="botanical-newsletter-form">
              <label className="visually-hidden" htmlFor="botanical-email">
                Email address
              </label>
              <input id="botanical-email" type="email" placeholder={newsletter.inputPlaceholder} />
              <button type="submit" disabled={newsletter.disabled}>
                {newsletter.buttonLabel}
              </button>
            </form>
          </div>
        </section>
      ) : null}

      {footer}
    </main>
  );
}

function EmptyState({ text }: { text?: ReactNode }) {
  return (
    <div className="empty-state">
      <h2>No published articles yet</h2>
      {text ? <p>{text}</p> : null}
    </div>
  );
}
