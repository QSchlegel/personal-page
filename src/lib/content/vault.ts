import fs from "node:fs";
import path from "node:path";

import matter from "gray-matter";
import { slug as slugify } from "github-slugger";

import { frontmatterSchema, type Note, type NoteType } from "@/lib/content/types";
import type { ResolvedWikiLink, WikiLinkResolver } from "@/lib/content/wikilinks";

const VAULT_DIR = path.join(process.cwd(), "content", "vault");

/** Canonical URL: 6-pagers are the SEO article surface, notes live in the vault. */
export function urlForNote(type: NoteType, slug: string): string {
  return type === "6-pager" ? `/blog/${slug}` : `/vault/${slug}`;
}

function toIsoString(value: string | Date | undefined): string | undefined {
  if (!value) {
    return undefined;
  }
  return value instanceof Date ? value.toISOString() : value;
}

function parseNote(filePath: string): Note | null {
  const { data, content } = matter(fs.readFileSync(filePath, "utf8"));
  const parsed = frontmatterSchema.safeParse(data);
  if (!parsed.success) {
    console.warn(`[vault] Skipping ${path.basename(filePath)}: ${parsed.error.issues[0]?.message ?? "invalid frontmatter"}`);
    return null;
  }
  const fm = parsed.data;
  const slug = fm.slug ?? slugify(path.basename(filePath, path.extname(filePath)));
  return {
    slug,
    title: fm.title,
    description: fm.description,
    tags: fm.tags,
    type: fm.type,
    publish: fm.publish,
    visibility: fm.visibility,
    pdf: fm.pdf,
    created: toIsoString(fm.created),
    updated: toIsoString(fm.updated),
    ogImage: fm.ogImage,
    aliases: fm.aliases,
    content,
    filePath,
    url: urlForNote(fm.type, slug),
  };
}

let cache: Note[] | null = null;

function readVault(): Note[] {
  // Memoize for the production build (SSG); re-read in dev so edits show up.
  if (cache && process.env.NODE_ENV === "production") {
    return cache;
  }
  let files: string[] = [];
  try {
    files = fs.readdirSync(VAULT_DIR).filter((file) => file.endsWith(".md"));
  } catch {
    files = [];
  }
  cache = files
    .map((file) => parseNote(path.join(VAULT_DIR, file)))
    .filter((note): note is Note => note !== null);
  return cache;
}

export function getAllNotes(): Note[] {
  return readVault();
}

export function getPublishedNotes(): Note[] {
  return readVault().filter((note) => note.publish);
}

/**
 * Notes eligible for the AI concierge knowledge base: only "public" and
 * "gated" tiers are ever embedded. Private notes (and the CV) never leave the
 * filesystem — this is the hard guarantee behind the disclosure policy, enforced
 * at ingestion time rather than relying on the prompt alone.
 */
export function getCorpusNotes(): Note[] {
  return readVault().filter((note) => note.visibility === "public" || note.visibility === "gated");
}

export function getSixPagers(): Note[] {
  return getPublishedNotes()
    .filter((note) => note.type === "6-pager")
    .sort((a, b) => (b.created ?? "").localeCompare(a.created ?? ""));
}

export function getNoteBySlug(slug: string): Note | undefined {
  return readVault().find((note) => note.slug === slug);
}

export function getPublishedNoteBySlug(slug: string): Note | undefined {
  return getPublishedNotes().find((note) => note.slug === slug);
}

function normalizeKey(value: string): string {
  return value.trim().toLowerCase();
}

/**
 * Resolve a [[wikilink]] target — matched by title, slug, slugified title, or
 * alias — to a published note's canonical URL. Unresolved targets return null
 * so the renderer can show them as dashed "not yet written" stubs.
 */
export function buildResolver(notes: Note[] = getPublishedNotes()): WikiLinkResolver {
  const index = new Map<string, Note>();
  for (const note of notes) {
    for (const key of [note.title, note.slug, slugify(note.title), ...note.aliases]) {
      const normalized = normalizeKey(key);
      if (normalized && !index.has(normalized)) {
        index.set(normalized, note);
      }
    }
  }
  return (target: string): ResolvedWikiLink | null => {
    const note = index.get(normalizeKey(target)) ?? index.get(normalizeKey(slugify(target)));
    return note ? { url: note.url, title: note.title, exists: true } : null;
  };
}
