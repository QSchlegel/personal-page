import type { Metadata } from "next";
import Link from "next/link";

import { VaultGraph } from "@/components/vault/VaultGraph";
import { getGraph } from "@/lib/content/graph";
import { getPublishedNotes } from "@/lib/content/vault";
import type { Note } from "@/lib/content/types";

export const metadata: Metadata = {
  title: "The Vault — Quirin Schlegel",
  description:
    "An evolving knowledge graph of interlinked notes and six-pagers. Follow a thread between ideas, or wander the index.",
  alternates: { canonical: "/vault" },
};

function NoteGrid({ notes }: { notes: Note[] }) {
  return (
    <div className="note-grid">
      {notes.map((note) => (
        <Link key={note.slug} href={note.url} className="note-card">
          <span className="kicker">{note.type === "6-pager" ? "six-pager" : "note"}</span>
          <h3>{note.title}</h3>
          <p>{note.description}</p>
        </Link>
      ))}
    </div>
  );
}

export default function VaultPage() {
  const notes = getPublishedNotes();
  const graph = getGraph();
  const sixPagers = notes.filter((note) => note.type === "6-pager");
  const atomicNotes = notes.filter((note) => note.type === "note");

  return (
    <>
      <header className="index-head article-head">
        <p className="eyebrow">Knowledge Vault</p>
        <h1>The Vault</h1>
        <p className="subtitle">
          An evolving graph of interlinked notes. Click a node to follow a thread — or wander the index below.
        </p>
      </header>

      <VaultGraph data={graph} />

      {sixPagers.length > 0 ? (
        <section>
          <h2>Six-pagers</h2>
          <NoteGrid notes={sixPagers} />
        </section>
      ) : null}

      {atomicNotes.length > 0 ? (
        <section>
          <h2>Notes</h2>
          <NoteGrid notes={atomicNotes} />
        </section>
      ) : null}
    </>
  );
}
