"use client";

import { useRef, useEffect, useMemo, useState, useTransition } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import LinkExtension from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import { Extension, Mark, Node } from "@tiptap/core";
import type { ArticleView } from "@/db/repositories/content";
import type { Category, Tag } from "@/db/seed-data";

const ImageNode = Node.create({
  name: "image",
  group: "block",
  atom: true,

  addAttributes() {
    return {
      src: { default: null },
      alt: { default: "" },
    };
  },

  parseHTML() {
    return [{ tag: "img[src]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["img", HTMLAttributes];
  },
});

const StyledText = Mark.create({
  name: "styledText",
  group: "inline",
  spanning: true,

  addAttributes() {
    return {
      color: {
        default: null,
        parseHTML: (element) => element.style.color || null,
      },
      fontSize: {
        default: null,
        parseHTML: (element) => element.style.fontSize || null,
      },
    };
  },

  parseHTML() {
    return [{ tag: "span[style]" }];
  },

  renderHTML({ HTMLAttributes }) {
    const styles = [
      HTMLAttributes.color ? `color: ${HTMLAttributes.color}` : "",
      HTMLAttributes.fontSize ? `font-size: ${HTMLAttributes.fontSize}` : "",
    ].filter(Boolean);

    return ["span", styles.length ? { style: styles.join("; ") } : {}, 0];
  },
});

const TextAlignment = Extension.create({
  name: "textAlignment",

  addGlobalAttributes() {
    return [
      {
        types: ["heading", "paragraph"],
        attributes: {
          textAlign: {
            default: null,
            parseHTML: (element) => element.style.textAlign || null,
            renderHTML: (attributes) => {
              if (!attributes.textAlign) return {};
              return { style: `text-align: ${attributes.textAlign}` };
            },
          },
        },
      },
    ];
  },
});

interface ArticleFormProps {
  action: (formData: FormData) => void | Promise<void>;
  article?: ArticleView | null;
  categories: Category[];
  errorMessage?: string | null;
  tags: Tag[];
}

type UploadResult =
  | {
      ok: true;
      url: string;
    }
  | {
      error: string;
      ok: false;
    };

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 90);
}

function todayDateInputValue() {
  const date = new Date();
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return localDate.toISOString().slice(0, 10);
}

function toDateInputValue(value?: string) {
  if (!value) return todayDateInputValue();
  const rawDate = value.match(/^\d{4}-\d{2}-\d{2}/)?.[0];
  if (rawDate) return rawDate;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return todayDateInputValue();
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return localDate.toISOString().slice(0, 10);
}

async function uploadArticleImage(file: File, kind: "body" | "cover"): Promise<UploadResult> {
  const formData = new FormData();
  formData.set("image", file);
  formData.set("kind", kind);

  try {
    const response = await fetch("/admin/articles/upload", {
      body: formData,
      method: "POST",
    });
    const result = (await response.json()) as UploadResult;

    if (!response.ok && result.ok) {
      return { error: "Image upload failed. Please try again.", ok: false };
    }

    return result;
  } catch {
    return { error: "Image upload failed. Please try again.", ok: false };
  }
}

export function ArticleForm({ action, article, categories, errorMessage, tags }: ArticleFormProps) {
  const selectedTagSlugs = useMemo(() => new Set(article?.tags.map((tag) => tag.slug) ?? []), [article]);
  const bodyImageInputRef = useRef<HTMLInputElement>(null);
  const coverImageInputRef = useRef<HTMLInputElement>(null);
  const [isBodyImageUploading, startBodyImageUploadTransition] = useTransition();
  const [isCoverUploading, startCoverUploadTransition] = useTransition();
  const [bodyImageUploadError, setBodyImageUploadError] = useState<string | null>(null);
  const [coverUploadError, setCoverUploadError] = useState<string | null>(null);
  const [title, setTitle] = useState(article?.title ?? "");
  const [slug, setSlug] = useState(article?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(Boolean(article?.slug));
  const [coverUrl, setCoverUrl] = useState(article?.coverUrl ?? "");
  const [bodyHtml, setBodyHtml] = useState(article?.bodyHtml ?? "<p></p>");

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit,
      LinkExtension.configure({
        openOnClick: false,
      }),
      Placeholder.configure({
        placeholder: "Write the article body...",
      }),
      ImageNode,
      StyledText,
      TextAlignment,
    ],
    content: bodyHtml,
    editorProps: {
      attributes: {
        class: "rich-editor-content",
      },
    },
    onUpdate({ editor }) {
      setBodyHtml(editor.getHTML());
    },
  });

  useEffect(() => {
    if (!slugTouched) {
      setSlug(slugify(title));
    }
  }, [slugTouched, title]);

  function setLink() {
    if (!editor) return;
    const previousUrl = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt("Link URL", previousUrl ?? "");
    if (url === null) return;
    if (!url.trim()) {
      editor.chain().focus().unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: url.trim() }).run();
  }

  function insertImage() {
    if (!editor) return;
    const url = window.prompt("Image URL");
    if (!url?.trim()) return;
    editor.chain().focus().insertContent({ type: "image", attrs: { src: url.trim(), alt: "" } }).run();
  }

  function applyTextStyle(style: { color?: string; fontSize?: string }) {
    if (!editor) return;
    editor.chain().focus().setMark("styledText", style).run();
  }

  function setTextAlign(textAlign: "left" | "center" | "right" | "justify") {
    if (!editor) return;
    const chain = editor.chain().focus();

    if (editor.isActive("heading")) {
      chain.updateAttributes("heading", { textAlign }).run();
      return;
    }

    chain.updateAttributes("paragraph", { textAlign }).run();
  }

  function uploadCoverImage(file: File | undefined) {
    if (!file) return;

    setCoverUploadError(null);

    startCoverUploadTransition(async () => {
      const result = await uploadArticleImage(file, "cover");
      if (!result.ok) {
        setCoverUploadError(result.error);
        return;
      }

      setCoverUrl(result.url);
    });
  }

  function uploadBodyImage(file: File | undefined) {
    if (!file || !editor) return;

    setBodyImageUploadError(null);

    startBodyImageUploadTransition(async () => {
      const result = await uploadArticleImage(file, "body");
      if (!result.ok) {
        setBodyImageUploadError(result.error);
        return;
      }

      editor.chain().focus().insertContent({ type: "image", attrs: { src: result.url, alt: "" } }).run();
      setBodyHtml(editor.getHTML());
    });
  }

  return (
    <form action={action} className="form-grid article-form">
      {errorMessage ? (
        <div className="form-error" role="alert">
          {errorMessage}
        </div>
      ) : null}

      <div className="form-grid two-columns">
        <label className="field">
          <span>Title</span>
          <input
            name="title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="System novels are heating up again"
            required
          />
        </label>
        <label className="field">
          <span>Slug</span>
          <input
            name="slug"
            value={slug}
            onChange={(event) => {
              setSlugTouched(true);
              setSlug(slugify(event.target.value));
            }}
            placeholder="system-novels-heat-rises"
            required
          />
        </label>
      </div>

      <label className="field">
        <span>Summary</span>
        <textarea
          name="summary"
          rows={3}
          defaultValue={article?.summary}
          placeholder="A short summary for article lists and SEO previews."
          required
        />
      </label>

      <div className="form-grid two-columns">
        <label className="field">
          <span>Category</span>
          <select name="categorySlug" defaultValue={article?.category.slug ?? categories[0]?.slug} required>
            {categories.map((category) => (
              <option value={category.slug} key={category.slug}>
                {category.name}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Tags</span>
          <div className="tag-checkbox-grid">
            {tags.map((tag) => (
              <label key={tag.slug}>
                <input name="tagSlugs" type="checkbox" value={tag.slug} defaultChecked={selectedTagSlugs.has(tag.slug)} />
                {tag.name}
              </label>
            ))}
          </div>
        </label>
      </div>

      <label className="field">
        <span>Publish Date</span>
        <input name="publishedAt" type="date" defaultValue={toDateInputValue(article?.publishedAt)} />
      </label>

      <section className="editor-media-panel">
        <label className="field cover-url-field">
          <span>Featured Image</span>
          <input
            name="coverUrl"
            value={coverUrl}
            onChange={(event) => setCoverUrl(event.target.value)}
            placeholder="Paste a cover image URL"
          />
          <input
            ref={coverImageInputRef}
            accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
            className="visually-hidden"
            onChange={(event) => {
              uploadCoverImage(event.target.files?.[0]);
              event.target.value = "";
            }}
            type="file"
          />
          <div className="media-upload-row">
            <button
              className="button button-secondary-dark button-compact"
              disabled={isCoverUploading}
              onClick={() => coverImageInputRef.current?.click()}
              type="button"
            >
              {isCoverUploading ? "Uploading..." : "Upload Image"}
            </button>
            {coverUploadError ? (
              <span className="upload-error" role="alert">
                {coverUploadError}
              </span>
            ) : null}
          </div>
        </label>
        <div className="cover-preview">
          {coverUrl ? <img src={coverUrl} alt="" /> : <span>No cover image</span>}
        </div>
      </section>

      <section className="rich-editor">
        <div className="rich-editor-toolbar" aria-label="Editor toolbar">
          <button type="button" onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}>
            H2
          </button>
          <button type="button" onClick={() => editor?.chain().focus().toggleHeading({ level: 3 }).run()}>
            H3
          </button>
          <button type="button" onClick={() => editor?.chain().focus().toggleBold().run()}>
            B
          </button>
          <button type="button" onClick={() => editor?.chain().focus().toggleItalic().run()}>
            I
          </button>
          <select
            defaultValue=""
            aria-label="Font size"
            onChange={(event) => {
              if (event.target.value) applyTextStyle({ fontSize: event.target.value });
            }}
          >
            <option value="">Size</option>
            <option value="0.9rem">Small</option>
            <option value="1rem">Normal</option>
            <option value="1.15rem">Large</option>
            <option value="1.35rem">XL</option>
            <option value="1.65rem">XXL</option>
          </select>
          <label className="toolbar-color">
            <span>Color</span>
            <input
              type="color"
              defaultValue="#111827"
              aria-label="Text color"
              onChange={(event) => applyTextStyle({ color: event.target.value })}
            />
          </label>
          <button type="button" onClick={() => setTextAlign("left")}>
            Left
          </button>
          <button type="button" onClick={() => setTextAlign("center")}>
            Center
          </button>
          <button type="button" onClick={() => setTextAlign("right")}>
            Right
          </button>
          <button type="button" onClick={() => setTextAlign("justify")}>
            Justify
          </button>
          <button type="button" onClick={() => editor?.chain().focus().toggleBulletList().run()}>
            List
          </button>
          <button type="button" onClick={() => editor?.chain().focus().toggleOrderedList().run()}>
            1.
          </button>
          <button type="button" onClick={() => editor?.chain().focus().toggleBlockquote().run()}>
            Quote
          </button>
          <button type="button" onClick={setLink}>
            Link
          </button>
          <button type="button" onClick={insertImage}>
            Image
          </button>
          <button
            disabled={isBodyImageUploading}
            onClick={() => bodyImageInputRef.current?.click()}
            type="button"
          >
            {isBodyImageUploading ? "Uploading..." : "Upload body image"}
          </button>
          <button type="button" onClick={() => editor?.chain().focus().undo().run()}>
            Undo
          </button>
          <button type="button" onClick={() => editor?.chain().focus().redo().run()}>
            Redo
          </button>
          {bodyImageUploadError ? (
            <span className="upload-error" role="alert">
              {bodyImageUploadError}
            </span>
          ) : null}
        </div>
        <input
          ref={bodyImageInputRef}
          accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
          className="visually-hidden"
          onChange={(event) => {
            uploadBodyImage(event.target.files?.[0]);
            event.target.value = "";
          }}
          type="file"
        />
        <EditorContent editor={editor} />
        <input name="bodyHtml" type="hidden" value={bodyHtml} />
        <input name="originalBodyHtml" type="hidden" value={article?.bodyHtml ?? ""} />
      </section>

      <div className="form-grid two-columns">
        <label className="field">
          <span>SEO title</span>
          <input name="seoTitle" defaultValue={article?.seoTitle} placeholder="Optional SEO title" />
        </label>
        <label className="field">
          <span>SEO description</span>
          <input name="seoDescription" defaultValue={article?.seoDescription} placeholder="Optional SEO description" />
        </label>
      </div>

      <div className="check-row">
        <label>
          <input name="isFeatured" type="checkbox" defaultChecked={article?.isFeatured} /> Feature as lead story
        </label>
        <label>
          <input name="isPinned" type="checkbox" defaultChecked={article?.isPinned} /> Pin as Featured Article
        </label>
      </div>
      <div className="button-row">
        <button className="button button-secondary-dark" name="intent" type="submit" value="draft">
          Save draft
        </button>
        <button className="button" name="intent" type="submit" value="publish">
          Publish
        </button>
      </div>
    </form>
  );
}
