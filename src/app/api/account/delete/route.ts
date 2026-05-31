import { z } from "zod";

import { writeAuditLog } from "@/lib/audit";
import { requireUser } from "@/lib/auth-helpers";
import { jsonError, jsonOk } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, cleanupRateLimits } from "@/lib/rate-limit";
import { getRequestIp } from "@/lib/security";

const schema = z.object({
  email: z.string().email().max(254),
});

/**
 * DSGVO Art. 17 — right to erasure.
 *
 * Requires the caller to type their email as a confirmation token (same
 * shape as GitHub's destructive flows). On confirm, in this order:
 *
 *   1. Hard-delete every private chat Thread the user participated in
 *      (Message + ThreadParticipant + BotEvent cascade from Thread). The
 *      schema's `Message.senderUserId onDelete: SetNull` would otherwise
 *      keep the user's message *content* visible to the admin inbox —
 *      not acceptable for an erasure request.
 *   2. Hard-delete the matching Subscriber row (NewsletterSend cascades).
 *      The public unsubscribe path keeps the row for accountability, but
 *      this is the user's own erasure request — email + IP + consent
 *      text + version must go.
 *   3. Hard-delete any DownloadLead rows for this email (no FK to User).
 *   4. Audit-log the deletion BEFORE we tear down the user — the row
 *      still exists so the actorUserId column is populated.
 *   5. `prisma.user.delete` — Session, Account, Passkey, ThreadParticipant
 *      (residual), BotIdentity, BotApiKey, BotEvent (recipient), and
 *      UserProfile cascade via existing `onDelete: Cascade`. AuditLog
 *      actorUserId is SetNull, so the entry from step 4 survives.
 *
 * Client signs the user out + redirects after a 2xx.
 */
export async function POST(request: Request) {
  const auth = await requireUser(request);
  if (!auth.ok) {
    return auth.response;
  }

  const ip = getRequestIp(request.headers);
  const rate = checkRateLimit(`account-delete:${ip ?? auth.session.user.id}`, 3, 60_000);
  if (!rate.allowed) {
    return jsonError("RATE_LIMITED", "Too many requests. Please try again shortly.", 429);
  }
  cleanupRateLimits();

  let body: z.infer<typeof schema>;
  try {
    body = schema.parse(await request.json());
  } catch {
    return jsonError("VALIDATION", "Please type your email to confirm.", 400);
  }

  if (body.email.trim().toLowerCase() !== auth.session.user.email.toLowerCase()) {
    return jsonError(
      "CONFIRMATION_MISMATCH",
      "The email you typed doesn't match the account.",
      400,
    );
  }

  const userId = auth.session.user.id;
  const email = auth.session.user.email.toLowerCase();

  // Collect what we're about to delete BEFORE we do it, for the audit log.
  const participantRows = await prisma.threadParticipant.findMany({
    where: { userId },
    select: { threadId: true },
  });
  const participantThreadIds = participantRows.map((r) => r.threadId);

  const createdThreads = await prisma.thread.findMany({
    where: { createdByUserId: userId, id: { notIn: participantThreadIds } },
    select: { id: true },
  });
  const threadIdsToDelete = Array.from(
    new Set([...participantThreadIds, ...createdThreads.map((t) => t.id)]),
  );

  const subscriber = await prisma.subscriber.findUnique({
    where: { email },
    select: { id: true, status: true },
  });

  // 1. Tear down chat content. Thread cascade handles Message,
  //    ThreadParticipant, BotEvent (via thread), and NewsletterSend is
  //    unrelated. Defensive deleteMany for any orphan messages.
  if (threadIdsToDelete.length > 0) {
    await prisma.thread.deleteMany({ where: { id: { in: threadIdsToDelete } } });
  }
  await prisma.message.deleteMany({ where: { senderUserId: userId } });

  // 2. Hard-delete the Subscriber row (NewsletterSend cascades).
  if (subscriber) {
    await prisma.subscriber.delete({ where: { id: subscriber.id } });
  }

  // 3. Hard-delete any DownloadLead rows for this email (no FK to User).
  const downloadLeads = await prisma.downloadLead.deleteMany({ where: { email } });

  // 4. Audit log BEFORE the user row goes away so the actorUserId column
  //    keeps a reference (it's onDelete: SetNull on AuditLog, so the row
  //    survives the cascade either way, but populated is nicer).
  await writeAuditLog({
    actorUserId: userId,
    action: "user.account_deleted",
    targetType: "User",
    targetId: userId,
    ipAddress: ip,
    userAgent: request.headers.get("user-agent"),
    metadata: {
      email,
      threadsDeleted: threadIdsToDelete.length,
      hadSubscriber: Boolean(subscriber),
      subscriberStatus: subscriber?.status ?? null,
      downloadLeadsDeleted: downloadLeads.count,
    },
  });

  // 5. Cascade-delete via the User row. The schema's onDelete clauses tear
  //    down Session, Account, Passkey, ThreadParticipant, BotIdentity,
  //    BotApiKey, BotEvent (recipient), UserProfile, etc. AuditLog
  //    actorUserId is SetNull, so the history we wrote above is preserved.
  await prisma.user.delete({ where: { id: userId } });

  return jsonOk({ ok: true }, 200);
}
