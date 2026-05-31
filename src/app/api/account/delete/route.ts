import { z } from "zod";

import { writeAuditLog } from "@/lib/audit";
import { requireUser } from "@/lib/auth-helpers";
import { jsonError, jsonOk } from "@/lib/http";
import { unsubscribeByToken } from "@/lib/newsletter";
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
 * shape as GitHub's destructive flows). On confirm:
 *
 *   1. Unsubscribe the corresponding Subscriber row, if any, using the
 *      existing token-based path so the audit trail matches the public
 *      one-click unsubscribe.
 *   2. Audit-log the deletion BEFORE we tear down the user — the User row
 *      still exists so the actor link is preserved on the AuditLog row.
 *   3. `prisma.user.delete` — Session, Account, Passkey, ThreadParticipant,
 *      Message.senderUserId (SetNull), BotIdentity, BotApiKey, BotEvent
 *      (recipient + generatedBy), UserProfile, AuditLog.actorUserId
 *      (SetNull) all cascade via the existing `onDelete` clauses in
 *      schema.prisma — no extra cleanup needed.
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

  // 1. Unsubscribe newsletter (if any) — DSGVO Art. 17 covers marketing data
  //    even though Subscriber has no FK to User.
  const subscriber = await prisma.subscriber.findUnique({
    where: { email },
    select: { unsubscribeToken: true, status: true },
  });
  if (subscriber && subscriber.status !== "UNSUBSCRIBED") {
    await unsubscribeByToken(subscriber.unsubscribeToken).catch(() => undefined);
  }

  // 2. Audit log BEFORE the user row goes away so the actorUserId column
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
      hadSubscriber: Boolean(subscriber),
      subscriberAlreadyUnsubscribed: subscriber?.status === "UNSUBSCRIBED",
    },
  });

  // 3. Cascade-delete via the User row. The schema's onDelete clauses tear
  //    down Session, Account, Passkey, ThreadParticipant, BotIdentity,
  //    BotApiKey, BotEvent, UserProfile, etc. AuditLog.actorUserId is
  //    SetNull, so the history we wrote above is preserved.
  await prisma.user.delete({ where: { id: userId } });

  return jsonOk({ ok: true }, 200);
}
