import { requireUser } from "@/lib/auth-helpers";
import { jsonError, jsonOk } from "@/lib/http";
import { unsubscribeByToken } from "@/lib/newsletter";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, cleanupRateLimits } from "@/lib/rate-limit";
import { getRequestIp } from "@/lib/security";

/**
 * Unsubscribe-from-account: look up the Subscriber row by the signed-in
 * user's email, then run the existing `unsubscribeByToken` helper so the
 * audit trail matches the public unsubscribe path exactly.
 */
export async function POST(request: Request) {
  const auth = await requireUser(request);
  if (!auth.ok) {
    return auth.response;
  }

  const ip = getRequestIp(request.headers);
  const rate = checkRateLimit(`account-newsletter:${ip ?? auth.session.user.id}`, 5, 60_000);
  if (!rate.allowed) {
    return jsonError("RATE_LIMITED", "Too many requests. Please try again shortly.", 429);
  }
  cleanupRateLimits();

  const email = auth.session.user.email.toLowerCase();
  const subscriber = await prisma.subscriber.findUnique({
    where: { email },
    select: { unsubscribeToken: true, status: true },
  });

  // Idempotent: if there's no row, or they're already unsubscribed, we
  // still return ok so the UI can flip its state cleanly.
  if (!subscriber || subscriber.status === "UNSUBSCRIBED") {
    return jsonOk({ ok: true, alreadyUnsubscribed: true });
  }

  const ok = await unsubscribeByToken(subscriber.unsubscribeToken);
  if (!ok) {
    return jsonError("UNSUBSCRIBE_FAILED", "Could not unsubscribe. Please try again.", 500);
  }

  return jsonOk({ ok: true, alreadyUnsubscribed: false });
}
