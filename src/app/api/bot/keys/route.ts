import { z } from "zod";

import { requireUser } from "@/lib/auth-helpers";
import { jsonError, jsonOk } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { makeKeyId, makeSecret, fingerprintSecret, getRequestIp } from "@/lib/security";
import { writeAuditLog } from "@/lib/audit";

const createKeySchema = z.object({
  name: z.string().min(2).max(64).default("Default Bot Key"),
});

export async function GET(request: Request) {
  const userResult = await requireUser(request);
  if (!userResult.ok) {
    return userResult.response;
  }

  const keys = await prisma.botApiKey.findMany({
    where: {
      userId: userResult.session.user.id,
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      keyId: true,
      name: true,
      lastUsedAt: true,
      createdAt: true,
      revokedAt: true,
    },
  });

  return jsonOk({
    keys: keys.map((key) => ({
      ...key,
      lastUsedAt: key.lastUsedAt?.toISOString() ?? null,
      createdAt: key.createdAt.toISOString(),
      revokedAt: key.revokedAt?.toISOString() ?? null,
    })),
  });
}

export async function POST(request: Request) {
  const userResult = await requireUser(request);
  if (!userResult.ok) {
    return userResult.response;
  }

  let body: z.infer<typeof createKeySchema>;
  try {
    body = createKeySchema.parse(await request.json());
  } catch (error) {
    return jsonError(
      "INVALID_BODY",
      error instanceof Error ? error.message : "Invalid request payload.",
      400,
    );
  }

  const botIdentity = await prisma.botIdentity.upsert({
    where: { userId: userResult.session.user.id },
    update: {},
    create: {
      userId: userResult.session.user.id,
      displayName: `${userResult.session.user.name} Bot`,
      relayEnabled: true,
    },
    select: {
      id: true,
    },
  });

  const keyId = makeKeyId();
  const rawSecret = makeSecret(32);
  const fingerprint = fingerprintSecret(rawSecret);

  const key = await prisma.botApiKey.create({
    data: {
      keyId,
      userId: userResult.session.user.id,
      botIdentityId: botIdentity.id,
      name: body.name,
      keyFingerprint: fingerprint,
    },
    select: {
      id: true,
      keyId: true,
      name: true,
      createdAt: true,
      lastUsedAt: true,
      revokedAt: true,
    },
  });

  await writeAuditLog({
    actorUserId: userResult.session.user.id,
    action: "bot.key.create",
    targetType: "BotApiKey",
    targetId: key.id,
    ipAddress: getRequestIp(request.headers),
    userAgent: request.headers.get("user-agent"),
    metadata: {
      keyId: key.keyId,
      name: key.name,
    },
  });

  return jsonOk(
    {
      key: {
        ...key,
        createdAt: key.createdAt.toISOString(),
        lastUsedAt: key.lastUsedAt?.toISOString() ?? null,
        revokedAt: key.revokedAt?.toISOString() ?? null,
      },
      secret: rawSecret,
      note: "Store this secret now. It is not shown again.",
    },
    201,
  );
}
