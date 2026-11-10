import { permanentRedirect } from "next/navigation";

export default async function LegacyNewsDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  permanentRedirect(`/guides/${encodeURIComponent(slug)}`);
}
