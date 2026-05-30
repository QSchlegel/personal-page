import fs from "node:fs";
import path from "node:path";

import { getPublishedNoteBySlug } from "@/lib/content/vault";
import { verifyDownloadToken } from "@/lib/download-token";
import { jsonError } from "@/lib/http";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token");
  if (!token) {
    return jsonError("BAD_REQUEST", "Missing token.", 400);
  }

  const payload = verifyDownloadToken(token);
  if (!payload) {
    return jsonError("INVALID_TOKEN", "This download link is invalid or has expired.", 401);
  }

  const note = getPublishedNoteBySlug(payload.slug);
  if (!note || note.type !== "6-pager" || !note.pdf) {
    return jsonError("NOT_FOUND", "Document not found.", 404);
  }

  // Resolve the committed PDF (kept outside /public so the gate is real).
  // basename() neutralises any path traversal in the frontmatter value.
  const filePath = path.join(process.cwd(), "content", "pdf", path.basename(note.pdf));
  let file: Buffer;
  try {
    file = fs.readFileSync(filePath);
  } catch {
    return jsonError("NOT_FOUND", "File not found.", 404);
  }

  // Best-effort: record that the lead actually downloaded.
  void prisma.downloadLead
    .updateMany({
      where: { email: payload.email, slug: payload.slug, downloadedAt: null },
      data: { downloadedAt: new Date() },
    })
    .catch(() => undefined);

  return new Response(new Uint8Array(file), {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `attachment; filename="${note.slug}.pdf"`,
      "cache-control": "private, no-store",
    },
  });
}
