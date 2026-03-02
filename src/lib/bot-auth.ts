import { prisma } from "@/lib/prisma";
import {
  buildCanonicalSignaturePayload,
  computeHmacHex,
  constantTimeEqualHex,
  isTimestampFresh,
} from "@/lib/security";

export interface BotAuthContext {
  keyId: string;
  userId: string;
  botIdentityId: string;
}

export async function verifyBotRequest(
  request: Request,
  rawBody: string,
): Promise<{ ok: true; context: BotAuthContext } | { ok: false; status: number; message: string }> {
  const keyId = request.headers.get("x-bot-key-id");
  const timestamp = request.headers.get("x-bot-timestamp");
  const signature = request.headers.get("x-bot-signature");

  if (!keyId || !timestamp || !signature) {
    return {
      ok: false,
      status: 401,
      message: "Missing bot authentication headers.",
    };
  }

  if (!isTimestampFresh(timestamp)) {
    return {
      ok: false,
      status: 401,
      message: "Bot request timestamp is outside the allowed window.",
    };
  }

  const apiKey = await prisma.botApiKey.findFirst({
    where: {
      keyId,
      revokedAt: null,
    },
    select: {
      keyId: true,
      userId: true,
      botIdentityId: true,
      keyFingerprint: true,
    },
  });

  if (!apiKey) {
    return {
      ok: false,
      status: 401,
      message: "Invalid bot API key.",
    };
  }

  const path = new URL(request.url).pathname;
  const canonicalPayload = buildCanonicalSignaturePayload({
    timestamp,
    method: request.method,
    path,
    body: rawBody,
  });

  const expectedSignature = computeHmacHex(apiKey.keyFingerprint, canonicalPayload);
  if (!constantTimeEqualHex(signature, expectedSignature)) {
    return {
      ok: false,
      status: 401,
      message: "Invalid bot signature.",
    };
  }

  await prisma.botApiKey.update({
    where: { keyId: apiKey.keyId },
    data: { lastUsedAt: new Date() },
  });

  return {
    ok: true,
    context: {
      keyId: apiKey.keyId,
      userId: apiKey.userId,
      botIdentityId: apiKey.botIdentityId,
    },
  };
}
