import { getCloudflareContext } from "@opennextjs/cloudflare";
import { isAdminSignedIn } from "@/lib/admin-guard";
import type { CloudflareEnv } from "@/types/cloudflare";

const allowedImageTypes = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
]);

const maxUploadSize = 10 * 1024 * 1024;

type ArticleImageFolder = "body" | "covers";

type UploadFile = {
  arrayBuffer: () => Promise<ArrayBuffer>;
  name: string;
  size: number;
  type: string;
};

type UploadResponse =
  | {
      ok: true;
      url: string;
    }
  | {
      error: string;
      ok: false;
    };

function json(body: UploadResponse, status = 200) {
  return Response.json(body, { status });
}

function isUploadFile(value: FormDataEntryValue | null): value is File & UploadFile {
  return (
    typeof value === "object" &&
    value !== null &&
    "arrayBuffer" in value &&
    "name" in value &&
    "size" in value &&
    "type" in value
  );
}

function getFolder(value: FormDataEntryValue | null): ArticleImageFolder | null {
  if (value === "body") return "body";
  if (value === "cover") return "covers";
  return null;
}

function getExtension(file: UploadFile) {
  const typeExtension = allowedImageTypes.get(file.type);
  if (!typeExtension) return null;

  const nameExtension = file.name.split(".").pop()?.toLowerCase();
  if (nameExtension === "jpeg") return "jpeg";
  if (nameExtension === "jpg") return "jpg";

  return typeExtension;
}

function getImageKey(file: UploadFile, folder: ArticleImageFolder) {
  const extension = getExtension(file);
  if (!extension) return null;

  const now = new Date();
  const year = String(now.getUTCFullYear());
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");

  return `${folder}/${year}/${month}/${crypto.randomUUID()}.${extension}`;
}

async function getMediaConfig() {
  try {
    const context = await getCloudflareContext<{ [key: string]: unknown }, ExecutionContext>({ async: true });
    const env = context.env as CloudflareEnv;
    return {
      bucket: env.MEDIA_BUCKET ?? null,
    };
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  try {
    if (!(await isAdminSignedIn())) {
      return json({ error: "Your admin session expired. Please sign in again before uploading.", ok: false }, 401);
    }

    const formData = await request.formData();
    const folder = getFolder(formData.get("kind"));
    if (!folder) {
      return json({ error: "Choose whether this is a cover or body image.", ok: false }, 400);
    }

    const file = formData.get("image");
    if (!isUploadFile(file) || file.size === 0) {
      return json({ error: "Choose an image to upload.", ok: false }, 400);
    }

    if (!allowedImageTypes.has(file.type)) {
      return json({ error: "Only JPG, JPEG, PNG, and WebP images are supported.", ok: false }, 400);
    }

    if (file.size > maxUploadSize) {
      return json({ error: "Image must be 10MB or smaller.", ok: false }, 400);
    }

    const key = getImageKey(file, folder);
    if (!key) {
      return json({ error: "Only JPG, JPEG, PNG, and WebP images are supported.", ok: false }, 400);
    }

    const mediaConfig = await getMediaConfig();
    if (!mediaConfig?.bucket) {
      return json({ error: "Media bucket is not available in this environment.", ok: false }, 503);
    }

    try {
      await mediaConfig.bucket.put(key, await file.arrayBuffer(), {
        httpMetadata: {
          cacheControl: "public, max-age=31536000, immutable",
          contentType: file.type,
        },
      });
    } catch (error) {
      console.error("R2 UPLOAD ERROR", error);
      return json({ error: "Image upload failed. Please try again.", ok: false }, 502);
    }

    const publicPath = `/media/${key}`;
    return json({ ok: true, url: publicPath });
  } catch (error) {
    console.error("R2 UPLOAD ERROR", error);
    return json({ error: "Image upload failed. Please try again.", ok: false }, 500);
  }
}
