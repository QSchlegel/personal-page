import type { Link, Parent, PhrasingContent, Root, Text } from "mdast";
import { visit } from "unist-util-visit";

export interface ResolvedWikiLink {
  url: string;
  title: string;
  /** false → the target note does not exist yet (render as a dashed stub). */
  exists: boolean;
}

export type WikiLinkResolver = (target: string) => ResolvedWikiLink | null;

// [[Target]] or [[Target|Alias]] or [[Target#Heading|Alias]]. Single line only.
const WIKILINK_RE = /\[\[([^\]\n]+?)\]\]/g;

/** Split `Target#Heading|Alias` into its target and optional alias. */
export function parseWikiLink(inner: string): { target: string; alias?: string } {
  const pipe = inner.indexOf("|");
  const rawTarget = pipe === -1 ? inner : inner.slice(0, pipe);
  const rawAlias = pipe === -1 ? undefined : inner.slice(pipe + 1);
  // Drop Obsidian heading (#...) and block (^...) references from the target.
  const target = rawTarget.replace(/[#^].*$/, "").trim();
  return { target, alias: rawAlias?.trim() || undefined };
}

/** All distinct wikilink targets in a raw markdown body (used to build edges). */
export function extractWikiLinkTargets(content: string): string[] {
  const targets = new Set<string>();
  for (const match of content.matchAll(WIKILINK_RE)) {
    const { target } = parseWikiLink(match[1]);
    if (target) {
      targets.add(target);
    }
  }
  return [...targets];
}

function makeWikiLinkNode(label: string, target: string, resolved: ResolvedWikiLink | null): Link {
  const exists = Boolean(resolved?.exists);
  return {
    type: "link",
    url: resolved?.url ?? "",
    title: null,
    children: [{ type: "text", value: label }],
    data: {
      // Render resolved links as <a>, unwritten concepts as a styled <span>.
      hName: exists ? "a" : "span",
      hProperties: {
        className: exists ? ["wikilink"] : ["wikilink", "wikilink-stub"],
        "data-wikilink": target,
        ...(exists ? {} : { title: "Not yet written" }),
      },
    },
  };
}

interface WikiLinkOptions {
  resolve: WikiLinkResolver;
}

/**
 * remark plugin: rewrite `[[wikilinks]]` in text into internal links (resolved)
 * or dashed stub spans (unresolved). Targets inside code or raw HTML/SVG are
 * left untouched because those are not `text` nodes.
 */
export function remarkWikiLink({ resolve }: WikiLinkOptions) {
  return (tree: Root) => {
    visit(tree, "text", (node: Text, index, parent: Parent | undefined) => {
      if (!parent || index === undefined || !node.value.includes("[[")) {
        return;
      }

      const value = node.value;
      const matches = [...value.matchAll(WIKILINK_RE)];
      if (matches.length === 0) {
        return;
      }

      const replacement: PhrasingContent[] = [];
      let lastIndex = 0;
      for (const match of matches) {
        const [full, inner] = match;
        const start = match.index ?? 0;
        if (start > lastIndex) {
          replacement.push({ type: "text", value: value.slice(lastIndex, start) });
        }
        const { target, alias } = parseWikiLink(inner);
        const resolved = target ? resolve(target) : null;
        replacement.push(makeWikiLinkNode(alias || target || full, target, resolved));
        lastIndex = start + full.length;
      }
      if (lastIndex < value.length) {
        replacement.push({ type: "text", value: value.slice(lastIndex) });
      }

      parent.children.splice(index, 1, ...replacement);
      return index + replacement.length;
    });
  };
}
