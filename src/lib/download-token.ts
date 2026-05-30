import { env } from "@/lib/env";
import { computeHmacHex, constantTimeEqualHex } from "@/lib/security";

const DEFAULT_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days

interface DownloadPayload {
  email: string;
  slug: string;
  exp: number;
}

function secret(): string {
  return env.DOWNLOAD_TOKEN_SECRET ?? env.BETTER_AUTH_SECRET;
}

/** Stateless, signed, expiring token that authorises one PDF download. */
export function createDownloadToken(email: string, slug: string, ttlSeconds = DEFAULT_TTL_SECONDS): string {
  const payload: DownloadPayload = {
    email,
    slug,
    exp: Math.floor(Date.now() / 1000) + ttlSeconds,
  };
  const data = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const signature = computeHmacHex(secret(), data);
  return `${data}.${signature}`;
}

export function verifyDownloadToken(token: string): DownloadPayload | null {
  const [data, signature] = token.split(".");
  if (!data || !signature) {
    return null;
  }
  if (!constantTimeEqualHex(signature, computeHmacHex(secret(), data))) {
    return null;
  }

  let payload: DownloadPayload;
  try {
    payload = JSON.parse(Buffer.from(data, "base64url").toString("utf8")) as DownloadPayload;
  } catch {
    return null;
  }

  if (!payload?.email || !payload?.slug || typeof payload.exp !== "number") {
    return null;
  }
  if (payload.exp < Math.floor(Date.now() / 1000)) {
    return null;
  }
  return payload;
}
