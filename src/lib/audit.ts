import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

interface AuditInput {
  actorUserId?: string | null;
  action: string;
  targetType?: string;
  targetId?: string;
  ipAddress?: string | null;
  userAgent?: string | null;
  metadata?: Prisma.InputJsonValue;
}

export async function writeAuditLog(input: AuditInput): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        actorUserId: input.actorUserId ?? null,
        action: input.action,
        targetType: input.targetType,
        targetId: input.targetId,
        ipAddress: input.ipAddress ?? null,
        userAgent: input.userAgent ?? null,
        metadata: input.metadata,
      },
    });
  } catch (error) {
    console.error("Failed to write audit log", error);
  }
}
