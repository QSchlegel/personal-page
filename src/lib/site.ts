/**
 * Absolute site origin used for canonical URLs, OpenGraph tags, email links,
 * and RSS. Prefers NEXT_PUBLIC_SITE_URL, falls back to the auth origin, then
 * localhost for dev.
 */
export function siteUrl(): string {
  const raw =
    process.env.NEXT_PUBLIC_SITE_URL ??
    process.env.BETTER_AUTH_URL ??
    process.env.NEXT_PUBLIC_APP_URL ??
    "http://localhost:3000";
  return raw.replace(/\/$/, "");
}

export function absoluteUrl(path: string): string {
  return `${siteUrl()}${path.startsWith("/") ? path : `/${path}`}`;
}
