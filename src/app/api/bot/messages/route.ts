import { Prisma } from "@prisma/client";
import { z } from "zod";

import { verifyBotRequest } from "@/lib/bot-auth";
import { createThreadMessage, ensurePrivateThread } from "@/lib/comms";
import { jsonError, jsonOk } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";
import { getRequestIp } from "@/lib/security";
import { writeAuditLog } from "@/lib/audit";

const bodySchema = z.object({
  toUserId: z.string().min(1),
  content: z.string().min(1).max(4000),
  threadId: z.string().min(1).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export async function POST(request: Request) {
  const rawBody = await request.text();

  const authResult = await verifyBotRequest(request, rawBody);
  if (!authResult.ok) {
    return jsonError("UNAUTHORIZED_BOT", authResult.message, authResult.status);
  }

  const rateKey = `bot:${authResult.context.keyId}:messages`;
  const rateResult = checkRateLimit(rateKey, 120, 60_000);
  if (!rateResult.allowed) {
    return jsonError("RATE_LIMITED", "Too many bot messages. Slow down.", 429, {
      resetAt: new Date(rateResult.resetAt).toISOString(),
    });
  }

  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(JSON.parse(rawBody));
  } catch (error) {
    return jsonError(
      "INVALID_BODY",
      error instanceof Error ? error.message : "Invalid request payload.",
      400,
    );
  }

  if (body.toUserId === authResult.context.userId) {
    return jsonError("INVALID_TARGET", "Bot cannot message its own user identity.", 400);
  }

  const recipient = await prisma.user.findUnique({
    where: { id: body.toUserId },
    select: { id: true },
  });

  if (!recipient) {
    return jsonError("RECIPIENT_NOT_FOUND", "Recipient user does not exist.", 404);
  }

  let threadId = body.threadId;
  if (threadId) {
    const thread = await prisma.thread.findFirst({
      where: {
        id: threadId,
        participants: { some: { userId: authResult.context.userId } },
        AND: [{ participants: { some: { userId: body.toUserId } } }],
      },
      select: { id: true },
    });

    if (!thread) {
      return jsonError("THREAD_NOT_FOUND", "Provided thread is not accessible.", 404);
    }
  } else {
    const thread = await ensurePrivateThread(
      authResult.context.userId,
      body.toUserId,
      authResult.context.userId,
    );
    threadId = thread.id;
  }

  try {
    const result = await createThreadMessage({
      threadId,
      senderType: "BOT",
      senderBotId: authResult.context.botIdentityId,
      actingUserId: authResult.context.userId,
      content: body.content,
      metadata: body.metadata as Prisma.InputJsonValue | undefined,
    });

    await writeAuditLog({
      actorUserId: authResult.context.userId,
      action: "bot.message.create",
      targetType: "Thread",
      targetId: threadId,
      ipAddress: getRequestIp(request.headers),
      userAgent: request.headers.get("user-agent"),
      metadata: {
        messageId: result.message.id,
        eventCount: result.events.length,
      },
    });

    return jsonOk({
      threadId,
      message: {
        ...result.message,
        createdAt: result.message.createdAt.toISOString(),
      },
      events: result.events,
    });
  } catch (error) {
    const failed = error instanceof Error ? error.message : "Unable to create bot message.";
    return jsonError("BOT_MESSAGE_FAILED", failed, 400);
  }
}
