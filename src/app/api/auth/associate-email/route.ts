import { z } from "zod";

import { requireUser } from "@/lib/auth-helpers";
import { jsonError, jsonOk } from "@/lib/http";
import { isBootstrapEmail } from "@/lib/identity";
import { createEmailVerificationLink } from "@/lib/passkey-email";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, cleanupRateLimits } from "@/lib/rate-limit";
import { getRequestIp } from "@/lib/security";

/**
 * Begin associating a real email with a freshly-registered passkey identity.
 *
 * Just after `addPasskey` succeeds the user's `User.email` is a synthetic
 * `passkey-<uuid>@local.invalid` placeholder. They can't be addressed by
 * other users in chat until this association runs. We require DSGVO consent
 * for processing (Art. 6(1)(a) GDPR) and offer — decoupled, per the
 * Kopplungsverbot — an optional newsletter sign-up.
 *
 * Rather than trust the typed address, we email a single-use verification link
 * and only write the email once it's clicked (see lib/passkey-email.ts).
 *
 * - Already-associated user: 409.
 * - Email belongs to another user: 409 EMAIL_TAKEN. The client surfaces a
 *   "claim" button that posts to /associate-email/claim to attach this passkey
 *   to that account via its own verification link.
 * - Otherwise: send an ASSOCIATE verification link to the address.
 */
const schema = z.object({
  email: z.string().email().max(254),
  consent: z.literal(true),
  newsletterOptIn: z.boolean().optional().default(false),
});

export async function POST(request: Request) {
  const auth = await requireUser(request);
  if (!auth.ok) {
    return auth.response;
  }

  const ip = getRequestIp(request.headers);
  const rate = checkRateLimit(`associate-email:${ip ?? auth.session.user.id}`, 5, 60_000);
  if (!rate.allowed) {
    return jsonError("RATE_LIMITED", "Too many requests. Please try again shortly.", 429);
  }
  cleanupRateLimits();

  let body: z.infer<typeof schema>;
  try {
    body = schema.parse(await request.json());
  } catch {
    return jsonError(
      "VALIDATION",
      "Please provide a valid email and agree to the consent box.",
      400,
    );
  }

  const currentUser = auth.session.user;
  const normalized = body.email.trim().toLowerCase();

  // Guard: already done.
  if (!isBootstrapEmail(currentUser.email)) {
    return jsonError(
      "ALREADY_ASSOCIATED",
      "An email is already associated with this account.",
      409,
    );
  }

  // Guard: email belongs to someone else. The client uses EMAIL_TAKEN to offer
  // the verification-link claim flow (POST /associate-email/claim).
  const existing = await prisma.user.findUnique({
    where: { email: normalized },
    select: { id: true },
  });
  if (existing && existing.id !== currentUser.id) {
    return jsonError(
      "EMAIL_TAKEN",
      "That email already belongs to another account. Sign in with its passkey instead.",
      409,
    );
  }

  // Send the verification link. The email is only written to the user record
  // when the link is clicked. If delivery fails, surface a retryable error
  // rather than telling the user to check an inbox that received nothing.
  const sent = await createEmailVerificationLink({
    kind: "ASSOCIATE",
    bootstrapUserId: currentUser.id,
    email: normalized,
    newsletterOptIn: body.newsletterOptIn,
    ipAddress: ip,
  });
  if (!sent.ok) {
    return jsonError(
      "EMAIL_SEND_FAILED",
      "We couldn't send the confirmation email. Please try again in a moment.",
      502,
    );
  }

  return jsonOk({ ok: true, verificationSent: true, email: normalized });
}
