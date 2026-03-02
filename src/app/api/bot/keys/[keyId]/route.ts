import { requireUser } from "@/lib/auth-helpers";
import { jsonError, jsonOk } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { getRequestIp } from "@/lib/security";
import { writeAuditLog } from "@/lib/audit";

interface RouteParams {
  params: Promise<{
    keyId: string;
  }>;
}

export async function DELETE(request: Request, context: RouteParams) {
  const userResult = await requireUser(request);
  if (!userResult.ok) {
    return userResult.response;
  }

  const { keyId } = await context.params;

  const existing = await prisma.botApiKey.findFirst({
    where: {
      keyId,
      userId: userResult.session.user.id,
    },
    select: { id: true, revokedAt: true },
  });

  if (!existing) {
    return jsonError("KEY_NOT_FOUND", "Bot key not found.", 404);
  }

  if (existing.revokedAt) {
    return jsonOk({ ok: true, alreadyRevoked: true });
  }

  await prisma.botApiKey.update({
    where: { keyId },
    data: { revokedAt: new Date() },
  });

  await writeAuditLog({
    actorUserId: userResult.session.user.id,
    action: "bot.key.revoke",
    targetType: "BotApiKey",
    targetId: existing.id,
    ipAddress: getRequestIp(request.headers),
    userAgent: request.headers.get("user-agent"),
    metadata: { keyId },
  });

  return jsonOk({ ok: true });
}
