import { BotEventStatus } from "@prisma/client";

import { verifyBotRequest } from "@/lib/bot-auth";
import { jsonError, jsonOk } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { getRequestIp } from "@/lib/security";
import { writeAuditLog } from "@/lib/audit";

interface RouteParams {
  params: Promise<{ eventId: string }>;
}

export async function POST(request: Request, context: RouteParams) {
  const rawBody = await request.text();
  const authResult = await verifyBotRequest(request, rawBody);
  if (!authResult.ok) {
    return jsonError("UNAUTHORIZED_BOT", authResult.message, authResult.status);
  }

  const { eventId } = await context.params;

  const event = await prisma.botEvent.findFirst({
    where: {
      id: eventId,
      recipientUserId: authResult.context.userId,
    },
    select: {
      id: true,
      status: true,
      acknowledgedAt: true,
    },
  });

  if (!event) {
    return jsonError("EVENT_NOT_FOUND", "Bot event not found.", 404);
  }

  if (event.status === BotEventStatus.ACKNOWLEDGED) {
    return jsonOk({ ok: true, alreadyAcknowledged: true });
  }

  await prisma.botEvent.update({
    where: { id: event.id },
    data: {
      status: BotEventStatus.ACKNOWLEDGED,
      acknowledgedAt: new Date(),
    },
  });

  await writeAuditLog({
    actorUserId: authResult.context.userId,
    action: "bot.event.ack",
    targetType: "BotEvent",
    targetId: event.id,
    ipAddress: getRequestIp(request.headers),
    userAgent: request.headers.get("user-agent"),
  });

  return jsonOk({ ok: true, eventId: event.id });
}
