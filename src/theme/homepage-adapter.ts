import { resolveThemeComponent, type ResolvedThemeComponent } from "./component-resolver";

export type HomepageThemeComponents = {
  articleCard: ResolvedThemeComponent;
  categoryCard: ResolvedThemeComponent;
  featuredGrid: ResolvedThemeComponent;
  latestArticlesGrid: ResolvedThemeComponent;
  categoryGrid: ResolvedThemeComponent;
  homeSectionHeading: ResolvedThemeComponent;
  pagination: ResolvedThemeComponent;
};

export async function loadHomepageThemeComponents(): Promise<HomepageThemeComponents> {
  const [articleCard, categoryCard, featuredGrid, latestArticlesGrid, categoryGrid, homeSectionHeading, pagination] = await Promise.all([
    resolveThemeComponent("articleCard"),
    resolveThemeComponent("categoryCard"),
    resolveThemeComponent("featuredGrid"),
    resolveThemeComponent("latestArticlesGrid"),
    resolveThemeComponent("categoryGrid"),
    resolveThemeComponent("homeSectionHeading"),
    resolveThemeComponent("pagination"),
  ]);

  return {
    articleCard,
    categoryCard,
    featuredGrid,
    latestArticlesGrid,
    categoryGrid,
    homeSectionHeading,
    pagination,
  };
}
