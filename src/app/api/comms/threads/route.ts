import { z } from "zod";

import { ensurePrivateThread, createThreadMessage } from "@/lib/comms";
import { requireUser } from "@/lib/auth-helpers";
import { jsonError, jsonOk } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { getRequestIp } from "@/lib/security";
import { writeAuditLog } from "@/lib/audit";

const createThreadSchema = z
  .object({
    targetUserId: z.string().min(1).optional(),
    targetUserEmail: z.string().email().optional(),
    initialMessage: z.string().min(1).max(4000).optional(),
  })
  .refine((value) => Boolean(value.targetUserId || value.targetUserEmail), {
    message: "targetUserId or targetUserEmail is required",
  });

export async function GET(request: Request) {
  const userResult = await requireUser(request);
  if (!userResult.ok) {
    return userResult.response;
  }

  const userId = userResult.session.user.id;

  const threads = await prisma.thread.findMany({
    where: {
      participants: {
        some: { userId },
      },
    },
    orderBy: { updatedAt: "desc" },
    include: {
      participants: {
        include: {
          user: {
            select: {
              id: true,
              email: true,
              name: true,
              image: true,
            },
          },
        },
      },
      messages: {
        orderBy: { createdAt: "desc" },
        take: 1,
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
      },
    },
  });

  const data = threads.map((thread) => ({
    id: thread.id,
    status: thread.status,
    aiAutoReplyEnabled: thread.aiAutoReplyEnabled,
    updatedAt: thread.updatedAt.toISOString(),
    participants: thread.participants.map((participant) => ({
      id: participant.user.id,
      email: participant.user.email,
      name: participant.user.name,
      image: participant.user.image,
    })),
    lastMessage: thread.messages[0]
      ? {
          ...thread.messages[0],
          createdAt: thread.messages[0].createdAt.toISOString(),
        }
      : null,
  }));

  return jsonOk({ threads: data });
}

export async function POST(request: Request) {
  const userResult = await requireUser(request);
  if (!userResult.ok) {
    return userResult.response;
  }

  let body: z.infer<typeof createThreadSchema>;
  try {
    const json = await request.json();
    body = createThreadSchema.parse(json);
  } catch (error) {
    return jsonError(
      "INVALID_BODY",
      error instanceof Error ? error.message : "Invalid request payload.",
      400,
    );
  }

  const currentUser = userResult.session.user;

  const targetUser = body.targetUserId
    ? await prisma.user.findUnique({
        where: { id: body.targetUserId },
        select: { id: true, email: true, name: true, image: true },
      })
    : await prisma.user.findUnique({
        where: { email: body.targetUserEmail?.toLowerCase() },
        select: { id: true, email: true, name: true, image: true },
      });

  if (!targetUser) {
    return jsonError("USER_NOT_FOUND", "Target user was not found.", 404);
  }

  if (targetUser.id === currentUser.id) {
    return jsonError("INVALID_TARGET", "Cannot create a thread with yourself.", 400);
  }

  const thread = await ensurePrivateThread(currentUser.id, targetUser.id, currentUser.id);

  let createdMessageId: string | null = null;
  if (body.initialMessage) {
    const result = await createThreadMessage({
      threadId: thread.id,
      senderType: "USER",
      senderUserId: currentUser.id,
      actingUserId: currentUser.id,
      content: body.initialMessage,
    });

    createdMessageId = result.message.id;
  }

  await writeAuditLog({
    actorUserId: currentUser.id,
    action: "thread.create",
    targetType: "Thread",
    targetId: thread.id,
    ipAddress: getRequestIp(request.headers),
    userAgent: request.headers.get("user-agent"),
    metadata: {
      targetUserId: targetUser.id,
      initialMessageCreated: Boolean(createdMessageId),
    },
  });

  return jsonOk({
    thread: {
      id: thread.id,
      status: thread.status,
      aiAutoReplyEnabled: thread.aiAutoReplyEnabled,
      participants: thread.participants.map((participant) => ({
        id: participant.user.id,
        email: participant.user.email,
        name: participant.user.name,
        image: participant.user.image,
      })),
      createdMessageId,
    },
  });
}
