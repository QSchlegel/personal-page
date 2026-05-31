import { Prisma } from "@prisma/client";
import { z } from "zod";

import { writeAuditLog } from "@/lib/audit";
import { requireUser } from "@/lib/auth-helpers";
import { jsonError, jsonOk } from "@/lib/http";
import { isBootstrapEmail } from "@/lib/identity";
import {
  consentVersion,
  NEWSLETTER_CONSENT_TEXT,
  requestNewsletterOptIn,
} from "@/lib/newsletter";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, cleanupRateLimits } from "@/lib/rate-limit";
import { getRequestIp } from "@/lib/security";

/**
 * Associate a real email with a freshly-registered passkey identity.
 *
 * Just after `addPasskey` succeeds the user's `User.email` is a synthetic
 * `passkey-<uuid>@local.invalid` placeholder. They can't be addressed by
 * other users in chat until this association runs. We require DSGVO consent
 * for processing (Art. 6(1)(a) GDPR) and offer — decoupled, per the
 * Kopplungsverbot — an optional newsletter sign-up.
 *
 * - Already-associated user: 409.
 * - Email belongs to another user: 409.
 * - Email is already a CONFIRMED newsletter subscriber: silent link, no new
 *   double opt-in required.
 * - Otherwise: require `consent === true`; if `newsletterOptIn === true`
 *   ALSO trigger the standard double opt-in via requestNewsletterOptIn().
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

  // Guard: email belongs to someone else.
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

  // Branch: already a confirmed subscriber → silent link (no fresh opt-in
  // needed; they consented to processing for the newsletter at some point).
  // Otherwise we require explicit chat-processing consent (the zod literal
  // already enforces this; this check is defensive).
  const subscriber = await prisma.subscriber.findUnique({
    where: { email: normalized },
    select: { status: true },
  });
  const subscriberConfirmed = subscriber?.status === "CONFIRMED";

  if (!subscriberConfirmed && body.consent !== true) {
    return jsonError(
      "CONSENT_REQUIRED",
      "Please tick the consent box to continue.",
      400,
    );
  }

  // Update the user's email + flag as verified (we trust them for now —
  // there's no confirmation-link round-trip yet; if abuse becomes an issue
  // we can layer one on without changing this contract).
  //
  // The `findUnique` check above is necessary but not sufficient: two
  // concurrent requests could both pass it before either commits. The
  // database's @unique on User.email is the real authority — catch its
  // P2002 violation and surface the same EMAIL_TAKEN error the pre-check
  // would have returned.
  try {
    await prisma.user.update({
      where: { id: currentUser.id },
      data: { email: normalized, emailVerified: true },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return jsonError(
        "EMAIL_TAKEN",
        "That email already belongs to another account. Sign in with its passkey instead.",
        409,
      );
    }
    throw error;
  }

  // Decoupled, optional newsletter opt-in. requestNewsletterOptIn handles the
  // double opt-in flow for non-subscribers; if the address is already CONFIRMED
  // it short-circuits and just returns ok.
  let newsletterOptInSent = false;
  if (body.newsletterOptIn) {
    const result = await requestNewsletterOptIn({
      email: normalized,
      source: "associate-email",
      ipAddress: ip,
    });
    newsletterOptInSent = result.ok && !result.alreadyConfirmed;
  }

  await writeAuditLog({
    actorUserId: currentUser.id,
    action: "user.email_associated",
    targetType: "User",
    targetId: currentUser.id,
    ipAddress: ip,
    userAgent: request.headers.get("user-agent"),
    metadata: {
      email: normalized,
      consentText: NEWSLETTER_CONSENT_TEXT,
      consentVersion: consentVersion(),
      newsletterOptIn: body.newsletterOptIn === true,
      subscriberConfirmedAtAssociation: subscriberConfirmed,
    },
  });

  return jsonOk({
    ok: true,
    email: normalized,
    newsletterOptInSent,
    subscriberConfirmedAtAssociation: subscriberConfirmed,
  });
}
