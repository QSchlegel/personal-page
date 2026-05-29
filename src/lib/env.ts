import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().min(1).default("postgresql://postgres:postgres@localhost:5432/personal_page"),
  BETTER_AUTH_SECRET: z
    .string()
    .min(32)
    .default("dev-only-secret-change-me-0123456789-abcdefghijklmnopqrstuvwxyz"),
  BETTER_AUTH_URL: z.string().url().default("http://localhost:3000"),
  // Railway injects this automatically (e.g. "my-app-production.up.railway.app").
  // Used as a fallback for the canonical URL so passkeys work even before a
  // custom domain / BETTER_AUTH_URL is configured.
  RAILWAY_PUBLIC_DOMAIN: z.string().optional(),
  GITHUB_API_TOKEN: z.string().optional(),
  ADMIN_EMAIL_ALLOWLIST: z.string().default(""),
  CRON_SECRET: z.string().min(8).default("replace-this-cron-secret"),
  GITHUB_TIMELINE_USER: z.string().default("QSchlegel"),
  BOT_RELAY_URL: z.string().url().optional(),
  BOT_RELAY_TOKEN: z.string().min(8).default("replace-this-relay-token"),
  BOT_HMAC_SECRET_ROTATION_WINDOW_DAYS: z.coerce.number().int().positive().default(30),
  PUBLIC_TWITTER_URL: z.string().url().optional(),
  PUBLIC_GITHUB_URL: z.string().url().default("https://github.com/QSchlegel"),
  PUBLIC_LINKEDIN_URL: z.string().url().default("https://www.linkedin.com/in/quirin-schlegel-7553ba197/"),
  PUBLIC_EMAIL: z.string().email().default("mail@quirinschlegel.com"),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid environment variables", parsed.error.flatten().fieldErrors);
  throw new Error("Invalid environment configuration");
}

export const env = parsed.data;

export function getAdminAllowlist(): Set<string> {
  return new Set(
    env.ADMIN_EMAIL_ALLOWLIST.split(",")
      .map((entry) => entry.trim().toLowerCase())
      .filter(Boolean),
  );
}

const DEV_AUTH_URL = "http://localhost:3000";
let warnedMissingCanonical = false;

function normalizeOrigin(value: string): string {
  return value.replace(/\/$/, "");
}

function railwayOrigin(): string | null {
  if (!env.RAILWAY_PUBLIC_DOMAIN) {
    return null;
  }
  const host = env.RAILWAY_PUBLIC_DOMAIN.replace(/^https?:\/\//, "").replace(/\/$/, "");
  return host ? `https://${host}` : null;
}

/**
 * The canonical, externally-reachable origin of the app. This is the single
 * source of truth for the WebAuthn relying-party. Priority:
 *   1. BETTER_AUTH_URL when explicitly configured (not the dev default)
 *   2. https://$RAILWAY_PUBLIC_DOMAIN (auto-injected on Railway)
 *   3. the localhost dev default
 */
export function getCanonicalAuthUrl(): string {
  if (env.BETTER_AUTH_URL && env.BETTER_AUTH_URL !== DEV_AUTH_URL) {
    return normalizeOrigin(env.BETTER_AUTH_URL);
  }

  const railway = railwayOrigin();
  if (railway) {
    return railway;
  }

  if (env.NODE_ENV === "production" && !warnedMissingCanonical) {
    // A misconfigured production deploy will derive rpID "localhost", which the
    // browser rejects — surface it loudly rather than silently breaking passkeys.
    warnedMissingCanonical = true;
    console.warn(
      "[auth] BETTER_AUTH_URL is unset and no RAILWAY_PUBLIC_DOMAIN is present in production. " +
        "Passkeys will fail until BETTER_AUTH_URL is set to the public site URL.",
    );
  }

  return DEV_AUTH_URL;
}

/** Strip a leading "www." so the RP ID covers both the apex and www subdomain. */
function toRegistrableHost(hostname: string): string {
  return hostname.replace(/^www\./, "");
}

export function getRpIdFromUrl(url: string): string {
  try {
    return toRegistrableHost(new URL(url).hostname);
  } catch {
    return "localhost";
  }
}

/** The WebAuthn relying-party ID derived from the canonical URL. */
export function getRpId(): string {
  return getRpIdFromUrl(getCanonicalAuthUrl());
}

/**
 * Every origin WebAuthn assertions / registrations may legitimately come from.
 * Includes the canonical origin, its apex/www sibling, the Railway domain, and
 * localhost for development.
 */
export function getAuthOrigins(): string[] {
  const origins = new Set<string>();
  const canonical = getCanonicalAuthUrl();
  origins.add(canonical);

  try {
    const url = new URL(canonical);
    const host = url.hostname;
    const isIp = /^[\d.]+$/.test(host);
    if (host.startsWith("www.")) {
      origins.add(`${url.protocol}//${host.replace(/^www\./, "")}`);
    } else if (host !== "localhost" && !isIp) {
      origins.add(`${url.protocol}//www.${host}`);
    }
  } catch {
    // canonical is always a valid URL; ignore defensively
  }

  const railway = railwayOrigin();
  if (railway) {
    origins.add(railway);
  }

  origins.add("http://localhost:3000");
  origins.add("http://127.0.0.1:3000");
  return [...origins];
}
