import { permanentRedirect } from "next/navigation";

export default async function LegacyNewsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { page } = await searchParams;
  const parsedPage = Number(page);
  const destination = Number.isInteger(parsedPage) && parsedPage > 1 ? `/guides?page=${parsedPage}` : "/guides";
  permanentRedirect(destination);
}
