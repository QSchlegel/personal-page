import { BotEventStatus } from "@prisma/client";

import { verifyBotRequest } from "@/lib/bot-auth";
import { jsonError, jsonOk } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";

export async function GET(request: Request) {
  const authResult = await verifyBotRequest(request, "");
  if (!authResult.ok) {
    return jsonError("UNAUTHORIZED_BOT", authResult.message, authResult.status);
  }

  const rateKey = `bot:${authResult.context.keyId}:events`;
  const rateResult = checkRateLimit(rateKey, 300, 60_000);
  if (!rateResult.allowed) {
    return jsonError("RATE_LIMITED", "Too many bot event requests.", 429, {
      resetAt: new Date(rateResult.resetAt).toISOString(),
    });
  }

  const url = new URL(request.url);
  const limitParam = Number(url.searchParams.get("limit") ?? "20");
  const limit = Number.isFinite(limitParam)
    ? Math.max(1, Math.min(Math.floor(limitParam), 100))
    : 20;

  const now = new Date();

  const events = await prisma.botEvent.findMany({
    where: {
      recipientUserId: authResult.context.userId,
      status: {
        in: [BotEventStatus.PENDING, BotEventStatus.FAILED, BotEventStatus.DELIVERED],
      },
      OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: now } }],
    },
    orderBy: { createdAt: "asc" },
    take: limit,
    include: {
      message: {
        select: {
          id: true,
          senderType: true,
          senderUserId: true,
          senderBotId: true,
          content: true,
          createdAt: true,
        },
      },
    },
  });

  return jsonOk({
    events: events.map((event) => ({
      id: event.id,
      recipientUserId: event.recipientUserId,
      threadId: event.threadId,
      messageId: event.messageId,
      status: event.status,
      attempts: event.attempts,
      payload: event.payload,
      createdAt: event.createdAt.toISOString(),
      updatedAt: event.updatedAt.toISOString(),
      message: {
        ...event.message,
        createdAt: event.message.createdAt.toISOString(),
      },
    })),
  });
}
