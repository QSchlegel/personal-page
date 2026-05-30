import type { Metadata } from "next";
import Link from "next/link";

import { getSixPagers } from "@/lib/content/vault";

export const metadata: Metadata = {
  title: "Six-Pagers — Quirin Schlegel",
  description:
    "Long-form, illustrated monographs from the knowledge vault. Read on the web, or download the hand-set print PDF.",
  alternates: { canonical: "/blog" },
};

export default function BlogIndexPage() {
  const pagers = getSixPagers();

  return (
    <>
      <header className="index-head masthead">
        <p className="eyebrow">Knowledge Vault</p>
        <h1>Six-Pagers</h1>
        <p className="subtitle">
          Long-form, illustrated monographs. Read here, or download the hand-set print PDF.
        </p>
      </header>

      {pagers.length === 0 ? (
        <p>No six-pagers published yet — check back soon.</p>
      ) : (
        <div className="note-grid">
          {pagers.map((note) => (
            <Link key={note.slug} href={note.url} className="note-card">
              <span className="kicker">{note.tags[0] ?? "six-pager"}</span>
              <h3>{note.title}</h3>
              <p>{note.description}</p>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
