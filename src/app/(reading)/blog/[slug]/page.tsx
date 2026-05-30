import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { PdfDownloadForm } from "@/components/vault/PdfDownloadForm";
import { getBacklinks } from "@/lib/content/graph";
import { renderMarkdown } from "@/lib/content/markdown";
import { buildResolver, getPublishedNoteBySlug, getSixPagers } from "@/lib/content/vault";
import { absoluteUrl } from "@/lib/site";

export const dynamicParams = false;

interface ArticleParams {
  params: Promise<{ slug: string }>;
}

export function generateStaticParams() {
  return getSixPagers().map((note) => ({ slug: note.slug }));
}

export async function generateMetadata({ params }: ArticleParams): Promise<Metadata> {
  const { slug } = await params;
  const note = getPublishedNoteBySlug(slug);
  if (!note) {
    return {};
  }
  const url = absoluteUrl(note.url);
  return {
    title: `${note.title} — Quirin Schlegel`,
    description: note.description,
    keywords: note.tags,
    alternates: { canonical: url },
    openGraph: {
      title: note.title,
      description: note.description,
      url,
      type: "article",
      publishedTime: note.created,
      modifiedTime: note.updated ?? note.created,
      images: note.ogImage ? [absoluteUrl(note.ogImage)] : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title: note.title,
      description: note.description,
    },
  };
}

// JSON-LD: unicode-escape <, >, & so it is safe as plain script text children.
function jsonLdScript(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c").replace(/>/g, "\\u003e").replace(/&/g, "\\u0026");
}

export default async function ArticlePage({ params }: ArticleParams) {
  const { slug } = await params;
  const note = getPublishedNoteBySlug(slug);
  if (!note || note.type !== "6-pager") {
    notFound();
  }

  const content = await renderMarkdown(note.content, buildResolver());
  const backlinks = getBacklinks(note.slug);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: note.title,
    description: note.description,
    datePublished: note.created,
    dateModified: note.updated ?? note.created,
    keywords: note.tags.join(", "),
    author: { "@type": "Person", name: "Quirin Schlegel" },
    publisher: { "@type": "Person", name: "Quirin Schlegel" },
    mainEntityOfPage: absoluteUrl(note.url),
  };

  return (
    <article>
      <header className="masthead">
        <p className="eyebrow">Six-Pager · Knowledge Vault</p>
        <h1>{note.title}</h1>
        <p className="subtitle">{note.description}</p>
        <div className="article-meta">
          {note.updated ? <span>Updated {note.updated.slice(0, 10)}</span> : null}
          {note.tags.length > 0 ? <span>{note.tags.join(" · ")}</span> : null}
        </div>
      </header>

      <div className="article-body">{content}</div>

      {note.pdf ? <PdfDownloadForm slug={note.slug} title={note.title} /> : null}

      {backlinks.length > 0 ? (
        <section className="backlinks">
          <h2>Linked from</h2>
          <ul>
            {backlinks.map((backlink) => (
              <li key={backlink.slug}>
                <Link href={backlink.url}>{backlink.title}</Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <script type="application/ld+json">{jsonLdScript(jsonLd)}</script>
    </article>
  );
}
