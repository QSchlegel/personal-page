import { z } from "zod";

import { requireAdmin } from "@/lib/auth-helpers";
import { jsonError, jsonOk } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { getRequestIp } from "@/lib/security";
import { writeAuditLog } from "@/lib/audit";

const patchSchema = z
  .object({
    status: z.enum(["OPEN", "RESOLVED", "ARCHIVED"]).optional(),
    aiAutoReplyEnabled: z.boolean().optional(),
  })
  .refine((value) => value.status !== undefined || value.aiAutoReplyEnabled !== undefined, {
    message: "At least one field must be provided.",
  });

interface RouteParams {
  params: Promise<{
    threadId: string;
  }>;
}

export async function PATCH(request: Request, context: RouteParams) {
  const adminResult = await requireAdmin(request);
  if (!adminResult.ok) {
    return adminResult.response;
  }

  const { threadId } = await context.params;

  let body: z.infer<typeof patchSchema>;
  try {
    body = patchSchema.parse(await request.json());
  } catch (error) {
    return jsonError(
      "INVALID_BODY",
      error instanceof Error ? error.message : "Invalid request payload.",
      400,
    );
  }

  const thread = await prisma.thread.findUnique({ where: { id: threadId } });
  if (!thread) {
    return jsonError("THREAD_NOT_FOUND", "Thread does not exist.", 404);
  }

  const updated = await prisma.thread.update({
    where: { id: threadId },
    data: {
      status: body.status,
      aiAutoReplyEnabled: body.aiAutoReplyEnabled,
    },
    select: {
      id: true,
      status: true,
      aiAutoReplyEnabled: true,
      updatedAt: true,
    },
  });

  await writeAuditLog({
    actorUserId: adminResult.session.user.id,
    action: "admin.thread.update",
    targetType: "Thread",
    targetId: threadId,
    ipAddress: getRequestIp(request.headers),
    userAgent: request.headers.get("user-agent"),
    metadata: body,
  });

  return jsonOk({
    thread: {
      ...updated,
      updatedAt: updated.updatedAt.toISOString(),
    },
  });
}
