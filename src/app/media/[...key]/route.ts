import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { CloudflareEnv } from "@/types/cloudflare";

interface RouteContext {
  params: Promise<{
    key: string[];
  }>;
}

function isValidMediaKey(key: string) {
  return /^(body|covers)\/\d{4}\/\d{2}\/[0-9a-f-]+\.(jpe?g|png|webp)$/.test(key);
}

async function getMediaBucket() {
  try {
    const context = await getCloudflareContext<{ [key: string]: unknown }, ExecutionContext>({ async: true });
    const env = context.env as CloudflareEnv;
    return env.MEDIA_BUCKET ?? null;
  } catch {
    return null;
  }
}

export async function GET(_request: Request, context: RouteContext) {
  const { key: keyParts } = await context.params;
  const key = keyParts.join("/");

  if (!isValidMediaKey(key)) {
    return new Response("Not found", { status: 404 });
  }

  const bucket = await getMediaBucket();
  if (!bucket) {
    return new Response("Media bucket unavailable", { status: 503 });
  }

  const object = await bucket.get(key);
  if (!object) {
    return new Response("Not found", { status: 404 });
  }

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("cache-control", headers.get("cache-control") ?? "public, max-age=31536000, immutable");
  headers.set("etag", object.httpEtag);

  return new Response(object.body, { headers });
}
