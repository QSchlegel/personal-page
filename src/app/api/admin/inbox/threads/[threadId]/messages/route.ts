import { z } from "zod";

import { requireAdmin } from "@/lib/auth-helpers";
import { createThreadMessage } from "@/lib/comms";
import { jsonError, jsonOk } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { getRequestIp } from "@/lib/security";
import { writeAuditLog } from "@/lib/audit";

const createMessageSchema = z.object({
  content: z.string().min(1).max(4000),
});

interface RouteParams {
  params: Promise<{
    threadId: string;
  }>;
}

/**
 * Admin-scoped message access for the inbox. Unlike the participant-gated
 * /api/comms route, an admin can read and reply to any thread — this is the
 * surface the site owner uses to answer the conversations people start with
 * him, in one place, without having to also be wired in as a participant.
 */
export async function GET(request: Request, context: RouteParams) {
  const adminResult = await requireAdmin(request);
  if (!adminResult.ok) {
    return adminResult.response;
  }

  const { threadId } = await context.params;

  const thread = await prisma.thread.findUnique({
    where: { id: threadId },
    select: { id: true },
  });
  if (!thread) {
    return jsonError("THREAD_NOT_FOUND", "Thread does not exist.", 404);
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
  const adminResult = await requireAdmin(request);
  if (!adminResult.ok) {
    return adminResult.response;
  }

  const { threadId } = await context.params;

  const thread = await prisma.thread.findUnique({
    where: { id: threadId },
    select: { id: true },
  });
  if (!thread) {
    return jsonError("THREAD_NOT_FOUND", "Thread does not exist.", 404);
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
      senderUserId: adminResult.session.user.id,
      actingUserId: adminResult.session.user.id,
      content: body.content,
    });

    await writeAuditLog({
      actorUserId: adminResult.session.user.id,
      action: "admin.thread.message.create",
      targetType: "Thread",
      targetId: threadId,
      ipAddress: getRequestIp(request.headers),
      userAgent: request.headers.get("user-agent"),
      metadata: { messageId: result.message.id },
    });

    return jsonOk({
      message: {
        ...result.message,
        createdAt: result.message.createdAt.toISOString(),
      },
    });
  } catch (error) {
    return jsonError(
      "MESSAGE_CREATE_FAILED",
      error instanceof Error ? error.message : "Unable to create message.",
      400,
    );
  }
}
