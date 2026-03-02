import { BotEventStatus, Prisma, SenderType } from "@prisma/client";

import { env } from "@/lib/env";
import { moderateContent } from "@/lib/moderation";
import { prisma } from "@/lib/prisma";
import type { RelayDeliveryResult } from "@/lib/types";

export async function findPrivateThreadBetweenUsers(userA: string, userB: string) {
  return prisma.thread.findFirst({
    where: {
      kind: "PRIVATE",
      participants: {
        some: { userId: userA },
      },
      AND: [
        { participants: { some: { userId: userB } } },
        { participants: { none: { userId: { notIn: [userA, userB] } } } },
      ],
    },
    include: {
      participants: {
        include: {
          user: {
            select: { id: true, email: true, name: true, image: true },
          },
        },
      },
    },
  });
}

export async function ensurePrivateThread(userA: string, userB: string, createdByUserId?: string) {
  const existing = await findPrivateThreadBetweenUsers(userA, userB);
  if (existing) {
    return existing;
  }

  return prisma.thread.create({
    data: {
      kind: "PRIVATE",
      status: "OPEN",
      createdByUserId: createdByUserId ?? userA,
      participants: {
        create: [{ userId: userA }, { userId: userB }],
      },
    },
    include: {
      participants: {
        include: {
          user: {
            select: { id: true, email: true, name: true, image: true },
          },
        },
      },
    },
  });
}

export async function createThreadMessage(input: {
  threadId: string;
  senderType: SenderType;
  senderUserId?: string | null;
  senderBotId?: string | null;
  actingUserId?: string | null;
  content: string;
  metadata?: Prisma.InputJsonValue;
}): Promise<{
  message: {
    id: string;
    threadId: string;
    senderType: SenderType;
    senderUserId: string | null;
    senderBotId: string | null;
    content: string;
    createdAt: Date;
  };
  events: string[];
}> {
  const moderation = moderateContent(input.content);
  if (!moderation.allowed) {
    throw new Error(moderation.reason ?? "Message moderation rejected content.");
  }

  const thread = await prisma.thread.findUnique({
    where: { id: input.threadId },
    include: { participants: true },
  });

  if (!thread) {
    throw new Error("Thread not found.");
  }

  const message = await prisma.message.create({
    data: {
      threadId: input.threadId,
      senderType: input.senderType,
      senderUserId: input.senderUserId ?? null,
      senderBotId: input.senderBotId ?? null,
      content: input.content,
      metadata: input.metadata,
      moderated: false,
    },
    select: {
      id: true,
      threadId: true,
      senderType: true,
      senderUserId: true,
      senderBotId: true,
      content: true,
      createdAt: true,
    },
  });

  const recipientFilterUserId = input.actingUserId ?? input.senderUserId ?? null;
  const eventIds: string[] = [];

  if (thread.aiAutoReplyEnabled) {
    const recipients = thread.participants
      .map((participant) => participant.userId)
      .filter((userId) => userId !== recipientFilterUserId);

    for (const recipientUserId of recipients) {
      const event = await prisma.botEvent.create({
        data: {
          recipientUserId,
          threadId: thread.id,
          messageId: message.id,
          generatedByUserId: input.senderUserId ?? input.actingUserId ?? null,
          status: "PENDING",
          payload: {
            messageId: message.id,
            threadId: thread.id,
            recipientUserId,
            content: message.content,
            senderType: message.senderType,
            createdAt: message.createdAt.toISOString(),
          },
        },
        select: { id: true },
      });

      eventIds.push(event.id);
      void attemptRelayDelivery(event.id);
    }
  }

  await prisma.thread.update({
    where: { id: input.threadId },
    data: { updatedAt: new Date() },
  });

  return {
    message,
    events: eventIds,
  };
}

export async function attemptRelayDelivery(eventId: string): Promise<RelayDeliveryResult> {
  const event = await prisma.botEvent.findUnique({
    where: { id: eventId },
    include: {
      message: true,
      thread: true,
      recipientUser: {
        include: {
          botIdentity: true,
        },
      },
    },
  });

  if (!event) {
    return {
      eventId,
      success: false,
      error: "Bot event not found.",
      deliveredAt: new Date().toISOString(),
    };
  }

  if (!env.BOT_RELAY_URL || !event.recipientUser.botIdentity?.relayEnabled) {
    return {
      eventId,
      success: false,
      error: "Relay is not configured for this recipient.",
      deliveredAt: new Date().toISOString(),
    };
  }

  try {
    const response = await fetch(env.BOT_RELAY_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${env.BOT_RELAY_TOKEN}`,
      },
      body: JSON.stringify({
        eventId: event.id,
        recipientUserId: event.recipientUserId,
        threadId: event.threadId,
        message: {
          id: event.message.id,
          senderType: event.message.senderType,
          content: event.message.content,
          createdAt: event.message.createdAt,
        },
      }),
    });

    const responseBody = await response.text();

    await prisma.botDeliveryAttempt.create({
      data: {
        botEventId: event.id,
        status: response.ok ? "SUCCESS" : "FAILED",
        statusCode: response.status,
        responseBody,
      },
    });

    await prisma.botEvent.update({
      where: { id: event.id },
      data: {
        status: response.ok ? BotEventStatus.DELIVERED : BotEventStatus.FAILED,
        attempts: { increment: 1 },
        nextAttemptAt: response.ok ? null : new Date(Date.now() + 2 * 60 * 1000),
      },
    });

    return {
      eventId: event.id,
      success: response.ok,
      statusCode: response.status,
      error: response.ok ? undefined : `Relay request failed with status ${response.status}.`,
      deliveredAt: new Date().toISOString(),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown relay delivery error.";

    await prisma.botDeliveryAttempt.create({
      data: {
        botEventId: event.id,
        status: "FAILED",
        error: message,
      },
    });

    await prisma.botEvent.update({
      where: { id: event.id },
      data: {
        status: BotEventStatus.FAILED,
        attempts: { increment: 1 },
        nextAttemptAt: new Date(Date.now() + 2 * 60 * 1000),
      },
    });

    return {
      eventId: event.id,
      success: false,
      error: message,
      deliveredAt: new Date().toISOString(),
    };
  }
}
