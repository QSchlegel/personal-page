import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";

import { getBacklinks } from "@/lib/content/graph";
import { renderMarkdown } from "@/lib/content/markdown";
import { buildResolver, getPublishedNoteBySlug, getPublishedNotes } from "@/lib/content/vault";
import { absoluteUrl } from "@/lib/site";

export const dynamicParams = false;

interface NoteParams {
  params: Promise<{ slug: string }>;
}

export function generateStaticParams() {
  return getPublishedNotes().map((note) => ({ slug: note.slug }));
}

export async function generateMetadata({ params }: NoteParams): Promise<Metadata> {
  const { slug } = await params;
  const note = getPublishedNoteBySlug(slug);
  if (!note) {
    return {};
  }
  const url = absoluteUrl(note.url);
  return {
    title: `${note.title} — Vault · Quirin Schlegel`,
    description: note.description,
    alternates: { canonical: url },
    openGraph: { title: note.title, description: note.description, url, type: "article" },
  };
}

export default async function VaultNotePage({ params }: NoteParams) {
  const { slug } = await params;
  const note = getPublishedNoteBySlug(slug);
  if (!note) {
    notFound();
  }
  // Six-pagers are canonical at /blog/[slug]; keep one URL per note.
  if (note.type === "6-pager") {
    permanentRedirect(note.url);
  }

  const content = await renderMarkdown(note.content, buildResolver());
  const backlinks = getBacklinks(note.slug);

  return (
    <article>
      <header className="masthead">
        <p className="eyebrow">Vault Note</p>
        <h1>{note.title}</h1>
        {note.description ? <p className="subtitle">{note.description}</p> : null}
        {note.tags.length > 0 ? (
          <div className="article-meta">
            <span>{note.tags.join(" · ")}</span>
          </div>
        ) : null}
      </header>

      <div className="article-body">{content}</div>

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
    </article>
  );
}
