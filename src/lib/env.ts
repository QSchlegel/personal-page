import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().min(1).default("postgresql://postgres:postgres@localhost:5432/personal_page"),
  BETTER_AUTH_SECRET: z
    .string()
    .min(32)
    .default("dev-only-secret-change-me-0123456789-abcdefghijklmnopqrstuvwxyz"),
  BETTER_AUTH_URL: z.string().url().default("http://localhost:3000"),
  GITHUB_CLIENT_ID: z.string().optional(),
  GITHUB_CLIENT_SECRET: z.string().optional(),
  GITHUB_API_TOKEN: z.string().optional(),
  ADMIN_EMAIL_ALLOWLIST: z.string().default(""),
  CRON_SECRET: z.string().min(8).default("replace-this-cron-secret"),
  GITHUB_TIMELINE_USER: z.string().default("QSchlegel"),
  BOT_RELAY_URL: z.string().url().optional(),
  BOT_RELAY_TOKEN: z.string().min(8).default("replace-this-relay-token"),
  BOT_HMAC_SECRET_ROTATION_WINDOW_DAYS: z.coerce.number().int().positive().default(30),
  PUBLIC_TWITTER_URL: z.string().url().optional(),
  PUBLIC_GITHUB_URL: z.string().url().default("https://github.com/QSchlegel"),
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

export function getAuthOrigins(): string[] {
  const origins = new Set<string>();
  origins.add(env.BETTER_AUTH_URL);
  origins.add("http://localhost:3000");
  origins.add("http://127.0.0.1:3000");
  return [...origins];
}

export function getRpIdFromUrl(url: string): string {
  try {
    const parsedUrl = new URL(url);
    return parsedUrl.hostname;
  } catch {
    return "localhost";
  }
}
