import { notFound } from "next/navigation";
import {
  loadThemePreviewComponent,
  resolveThemePreviewByKey,
  type ThemePreviewEntry,
} from "@/theme/preview-resolver";

type PageProps = {
  params: Promise<{
    theme: string;
  }>;
};

export default async function ThemePreviewPage({ params }: PageProps) {
  const { theme } = await params;
  const entry = resolvePreviewOrNotFound(theme);
  const Preview = await loadThemePreviewComponent(entry);

  return <Preview />;
}

function resolvePreviewOrNotFound(theme: string): ThemePreviewEntry {
  try {
    return resolveThemePreviewByKey(theme);
  } catch {
    notFound();
  }
}
