import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  output: "standalone",
  outputFileTracingRoot: path.resolve(__dirname),
  // Resend renders React email templates by dynamically importing
  // @react-email/render. Bundling + minifying that (and react-dom/server) into
  // the Next server chunk mangles it into a runtime "b is not a function" crash
  // (seen on Railway). Keep these unbundled so they run from node_modules as
  // published — the runner installs them via `npm ci --omit=dev`.
  serverExternalPackages: ["resend", "@react-email/components", "@react-email/render"],
  // Vault pages are SSG, but several routes read content at runtime:
  //  - the PDF download route streams the committed PDF, and
  //  - the download/request + admin routes call getPublishedNoteBySlug(), which
  //    reads content/vault/*.md.
  // Trace those files into the standalone bundle explicitly (don't rely on
  // auto-tracing of dynamic fs reads).
  outputFileTracingIncludes: {
    "/api/vault/download": ["./content/pdf/**", "./content/vault/**"],
    "/api/vault/download-request": ["./content/vault/**"],
    "/admin/newsletter": ["./content/vault/**"],
    // The concierge ingest route reads content/vault/*.md at runtime to embed.
    "/api/admin/kb/ingest": ["./content/vault/**"],
  },
};

export default nextConfig;
