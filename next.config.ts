import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  output: "standalone",
  outputFileTracingRoot: path.resolve(__dirname),
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
  },
};

export default nextConfig;
