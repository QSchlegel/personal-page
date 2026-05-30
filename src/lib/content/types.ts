import { z } from "zod";

/**
 * Two kinds of note live in the vault:
 *  - "6-pager": a long-form monograph. Canonical URL is /blog/[slug] (the SEO
 *    article surface) and it also appears as a node in the vault graph.
 *  - "note": an atomic concept note. Lives at /vault/[slug].
 */
export const NOTE_TYPES = ["6-pager", "note"] as const;
export type NoteType = (typeof NOTE_TYPES)[number];

/** Accept a YAML date (parsed by gray-matter into a Date) or a plain string. */
const dateLike = z.union([z.string(), z.date()]).optional();

export const frontmatterSchema = z.object({
  title: z.string().min(1),
  slug: z.string().min(1).optional(),
  description: z.string().optional().default(""),
  tags: z.array(z.string()).optional().default([]),
  type: z.enum(NOTE_TYPES).optional().default("note"),
  publish: z.boolean().optional().default(false),
  /** Filename (within content/pdf) of the email-gated PDF. 6-pagers only. */
  pdf: z.string().optional(),
  created: dateLike,
  updated: dateLike,
  /** Absolute or root-relative OG/share image. */
  ogImage: z.string().optional(),
  /** Alternative titles a [[wikilink]] may use to reach this note. */
  aliases: z.array(z.string()).optional().default([]),
});

export type Frontmatter = z.infer<typeof frontmatterSchema>;

export interface Note {
  slug: string;
  title: string;
  description: string;
  tags: string[];
  type: NoteType;
  publish: boolean;
  pdf?: string;
  created?: string;
  updated?: string;
  ogImage?: string;
  aliases: string[];
  /** Raw markdown body (frontmatter stripped). */
  content: string;
  /** Absolute path on disk, for diagnostics. */
  filePath: string;
  /** Canonical site URL: /blog/[slug] for 6-pagers, /vault/[slug] for notes. */
  url: string;
}

export interface GraphNode {
  id: string;
  title: string;
  type: NoteType;
  url: string;
  /** Node weight (degree-based), used to size nodes in the force graph. */
  val: number;
}

export interface GraphLink {
  source: string;
  target: string;
}

export interface GraphData {
  nodes: GraphNode[];
  links: GraphLink[];
}
