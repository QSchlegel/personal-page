import { slug as slugify } from "github-slugger";

import type { GraphData, GraphLink, GraphNode, Note } from "@/lib/content/types";
import { getPublishedNotes } from "@/lib/content/vault";
import { extractWikiLinkTargets } from "@/lib/content/wikilinks";

function buildIndex(notes: Note[]): Map<string, Note> {
  const index = new Map<string, Note>();
  for (const note of notes) {
    for (const key of [note.title, note.slug, slugify(note.title), ...note.aliases]) {
      const normalized = key.trim().toLowerCase();
      if (normalized && !index.has(normalized)) {
        index.set(normalized, note);
      }
    }
  }
  return index;
}

let graphCache: GraphData | null = null;
let backlinksCache: Map<string, Note[]> | null = null;

function compute(): { graph: GraphData; backlinks: Map<string, Note[]> } {
  const notes = getPublishedNotes();
  const index = buildIndex(notes);

  const nodes = new Map<string, GraphNode>();
  for (const note of notes) {
    nodes.set(note.slug, { id: note.slug, title: note.title, type: note.type, url: note.url, val: 1 });
  }

  const links: GraphLink[] = [];
  const backlinks = new Map<string, Note[]>();
  const seenEdge = new Set<string>();

  for (const note of notes) {
    for (const target of extractWikiLinkTargets(note.content)) {
      const dest = index.get(target.trim().toLowerCase()) ?? index.get(slugify(target));
      if (!dest || dest.slug === note.slug) {
        continue;
      }
      const edgeKey = `${note.slug}->${dest.slug}`;
      if (seenEdge.has(edgeKey)) {
        continue;
      }
      seenEdge.add(edgeKey);
      links.push({ source: note.slug, target: dest.slug });

      const sourceNode = nodes.get(note.slug);
      const destNode = nodes.get(dest.slug);
      if (sourceNode) sourceNode.val += 1;
      if (destNode) destNode.val += 1;

      const incoming = backlinks.get(dest.slug) ?? [];
      if (!incoming.some((existing) => existing.slug === note.slug)) {
        incoming.push(note);
      }
      backlinks.set(dest.slug, incoming);
    }
  }

  return { graph: { nodes: [...nodes.values()], links }, backlinks };
}

function ensure(): { graph: GraphData; backlinks: Map<string, Note[]> } {
  if (graphCache && backlinksCache && process.env.NODE_ENV === "production") {
    return { graph: graphCache, backlinks: backlinksCache };
  }
  const result = compute();
  graphCache = result.graph;
  backlinksCache = result.backlinks;
  return result;
}

/** Full force-graph dataset (published notes + resolved wikilink edges). */
export function getGraph(): GraphData {
  return ensure().graph;
}

/** Published notes that link TO the given slug. */
export function getBacklinks(slug: string): Note[] {
  return ensure().backlinks.get(slug) ?? [];
}
