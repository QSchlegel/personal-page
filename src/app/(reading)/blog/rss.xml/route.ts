import { getSixPagers } from "@/lib/content/vault";
import { absoluteUrl } from "@/lib/site";

export const dynamic = "force-static";

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function GET() {
  const items = getSixPagers()
    .map((note) => {
      const link = absoluteUrl(note.url);
      const pubDate = note.created ? `<pubDate>${new Date(note.created).toUTCString()}</pubDate>` : "";
      return `    <item>
      <title>${escapeXml(note.title)}</title>
      <link>${link}</link>
      <guid isPermaLink="true">${link}</guid>
      <description>${escapeXml(note.description)}</description>
      ${pubDate}
    </item>`;
    })
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Quirin Schlegel — Six-Pagers</title>
    <link>${absoluteUrl("/blog")}</link>
    <description>Long-form, illustrated monographs from the knowledge vault.</description>
    <language>en</language>
${items}
  </channel>
</rss>`;

  return new Response(xml, {
    headers: { "content-type": "application/xml; charset=utf-8" },
  });
}
