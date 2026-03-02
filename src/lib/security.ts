import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

const DEFAULT_ALLOWED_DRIFT_SECONDS = 300;

export function makeKeyId(prefix = "bk"): string {
  return `${prefix}_${randomBytes(8).toString("hex")}`;
}

export function makeSecret(length = 32): string {
  return randomBytes(length).toString("base64url");
}

export function fingerprintSecret(secret: string): string {
  return createHash("sha256").update(secret).digest("hex");
}

export function buildCanonicalSignaturePayload(input: {
  timestamp: string;
  method: string;
  path: string;
  body: string;
}): string {
  return `${input.timestamp}.${input.method.toUpperCase()}.${input.path}.${input.body}`;
}

export function computeHmacHex(key: string, payload: string): string {
  return createHmac("sha256", key).update(payload).digest("hex");
}

export function constantTimeEqualHex(a: string, b: string): boolean {
  if (!a || !b || a.length !== b.length) {
    return false;
  }

  try {
    return timingSafeEqual(Buffer.from(a, "hex"), Buffer.from(b, "hex"));
  } catch {
    return false;
  }
}

export function isTimestampFresh(
  timestamp: string,
  allowedDriftSeconds = DEFAULT_ALLOWED_DRIFT_SECONDS,
): boolean {
  const numeric = Number(timestamp);
  if (!Number.isFinite(numeric)) {
    return false;
  }

  const nowSeconds = Math.floor(Date.now() / 1000);
  return Math.abs(nowSeconds - numeric) <= allowedDriftSeconds;
}

export function getRequestIp(headers: Headers): string | null {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) {
      return first;
    }
  }

  return headers.get("x-real-ip");
}
