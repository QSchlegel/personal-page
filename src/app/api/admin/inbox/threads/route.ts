import { requireAdmin } from "@/lib/auth-helpers";
import { jsonOk } from "@/lib/http";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const adminResult = await requireAdmin(request);
  if (!adminResult.ok) {
    return adminResult.response;
  }

  const threads = await prisma.thread.findMany({
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

  return jsonOk({
    threads: threads.map((thread) => ({
      id: thread.id,
      status: thread.status,
      aiAutoReplyEnabled: thread.aiAutoReplyEnabled,
      updatedAt: thread.updatedAt.toISOString(),
      createdAt: thread.createdAt.toISOString(),
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
    })),
  });
}
