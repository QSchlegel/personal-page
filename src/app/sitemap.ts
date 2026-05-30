import type { MetadataRoute } from "next";

import { getPublishedNotes } from "@/lib/content/vault";
import { absoluteUrl } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  // NOTE: /impressum is intentionally omitted while it is hidden.
  const staticRoutes = ["/", "/blog", "/vault", "/newsletter", "/privacy"].map((path) => ({
    url: absoluteUrl(path),
    lastModified: new Date(),
  }));

  const noteRoutes = getPublishedNotes().map((note) => ({
    url: absoluteUrl(note.url),
    lastModified: note.updated ? new Date(note.updated) : new Date(),
  }));

  return [...staticRoutes, ...noteRoutes];
}
