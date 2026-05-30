import type { ReactElement } from "react";
import * as prod from "react/jsx-runtime";

import rehypeAutolinkHeadings from "rehype-autolink-headings";
import rehypeRaw from "rehype-raw";
import rehypeReact from "rehype-react";
import rehypeSlug from "rehype-slug";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import { unified } from "unified";

import { remarkWikiLink, type WikiLinkResolver } from "@/lib/content/wikilinks";

const production = { Fragment: prod.Fragment, jsx: prod.jsx, jsxs: prod.jsxs };

/**
 * Render Obsidian-flavored markdown to a React element tree.
 *
 * Vault content is first-party and author-committed, so raw inline HTML/SVG
 * (the kickoff figures) is allowed through remark-rehype(allowDangerousHtml) +
 * rehype-raw, then turned into real React elements by rehype-react — so the
 * page renders the tree directly with no raw HTML injection. Do NOT feed
 * untrusted input here.
 */
export async function renderMarkdown(content: string, resolve: WikiLinkResolver): Promise<ReactElement> {
  const file = await unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkWikiLink, { resolve })
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(rehypeRaw)
    .use(rehypeSlug)
    .use(rehypeAutolinkHeadings, { behavior: "wrap" })
    .use(rehypeReact, production)
    .process(content);

  return file.result as ReactElement;
}
