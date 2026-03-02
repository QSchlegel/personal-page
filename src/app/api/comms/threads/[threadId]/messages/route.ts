import { Prisma } from "@prisma/client";
import { z } from "zod";

import { createThreadMessage } from "@/lib/comms";
import { requireUser } from "@/lib/auth-helpers";
import { jsonError, jsonOk } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { getRequestIp } from "@/lib/security";
import { writeAuditLog } from "@/lib/audit";

const createMessageSchema = z.object({
  content: z.string().min(1).max(4000),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

interface RouteParams {
  params: Promise<{
    threadId: string;
  }>;
}

export async function GET(request: Request, context: RouteParams) {
  const userResult = await requireUser(request);
  if (!userResult.ok) {
    return userResult.response;
  }

  const { threadId } = await context.params;

  const thread = await prisma.thread.findFirst({
    where: {
      id: threadId,
      participants: {
        some: { userId: userResult.session.user.id },
      },
    },
    select: { id: true },
  });

  if (!thread) {
    return jsonError("THREAD_NOT_FOUND", "Thread not found or inaccessible.", 404);
  }

  const messages = await prisma.message.findMany({
    where: { threadId },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      threadId: true,
      senderType: true,
      senderUserId: true,
      senderBotId: true,
      content: true,
      moderated: true,
      createdAt: true,
    },
  });

  return jsonOk({
    messages: messages.map((message) => ({
      ...message,
      createdAt: message.createdAt.toISOString(),
    })),
  });
}

export async function POST(request: Request, context: RouteParams) {
  const userResult = await requireUser(request);
  if (!userResult.ok) {
    return userResult.response;
  }

  const { threadId } = await context.params;

  const participant = await prisma.threadParticipant.findFirst({
    where: {
      threadId,
      userId: userResult.session.user.id,
    },
  });

  if (!participant) {
    return jsonError("FORBIDDEN", "You are not a participant of this thread.", 403);
  }

  let body: z.infer<typeof createMessageSchema>;
  try {
    body = createMessageSchema.parse(await request.json());
  } catch (error) {
    return jsonError(
      "INVALID_BODY",
      error instanceof Error ? error.message : "Invalid request payload.",
      400,
    );
  }

  try {
    const result = await createThreadMessage({
      threadId,
      senderType: "USER",
      senderUserId: userResult.session.user.id,
      actingUserId: userResult.session.user.id,
      content: body.content,
      metadata: body.metadata as Prisma.InputJsonValue | undefined,
    });

    await writeAuditLog({
      actorUserId: userResult.session.user.id,
      action: "thread.message.create",
      targetType: "Thread",
      targetId: threadId,
      ipAddress: getRequestIp(request.headers),
      userAgent: request.headers.get("user-agent"),
      metadata: {
        messageId: result.message.id,
        botEventsCreated: result.events.length,
      },
    });

    return jsonOk({
      message: {
        ...result.message,
        createdAt: result.message.createdAt.toISOString(),
      },
      events: result.events,
    });
  } catch (error) {
    return jsonError(
      "MESSAGE_CREATE_FAILED",
      error instanceof Error ? error.message : "Unable to create message.",
      400,
    );
  }
}
