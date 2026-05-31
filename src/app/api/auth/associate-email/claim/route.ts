import { z } from "zod";

import { requireUser } from "@/lib/auth-helpers";
import { jsonError, jsonOk } from "@/lib/http";
import { isBootstrapEmail } from "@/lib/identity";
import { createEmailVerificationLink } from "@/lib/passkey-email";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, cleanupRateLimits } from "@/lib/rate-limit";
import { getRequestIp } from "@/lib/security";

/**
 * Attach the freshly-registered passkey to an EXISTING account that already
 * owns the typed email — the recovery path for "I got a new device". We email
 * that address a CLAIM verification link; clicking it moves this passkey onto
 * the existing account and discards the bootstrap user (see lib/passkey-email).
 *
 * Only valid when the email genuinely belongs to another account (the client
 * reaches here after the /associate-email route returned EMAIL_TAKEN).
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
  const rate = checkRateLimit(`associate-email-claim:${ip ?? auth.session.user.id}`, 5, 60_000);
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

  // Only a bootstrap (freshly-registered) identity can claim into another
  // account — an already-associated user has nothing to merge.
  if (!isBootstrapEmail(currentUser.email)) {
    return jsonError(
      "ALREADY_ASSOCIATED",
      "An email is already associated with this account.",
      409,
    );
  }

  const target = await prisma.user.findUnique({
    where: { email: normalized },
    select: { id: true },
  });
  if (!target || target.id === currentUser.id) {
    // No existing account owns this address — there's nothing to attach to.
    // The caller should use the normal /associate-email flow instead.
    return jsonError(
      "NO_TARGET",
      "No existing account uses that email. Use the normal email confirmation instead.",
      400,
    );
  }

  await createEmailVerificationLink({
    kind: "CLAIM",
    bootstrapUserId: currentUser.id,
    targetUserId: target.id,
    email: normalized,
    newsletterOptIn: body.newsletterOptIn,
    ipAddress: ip,
  });

  return jsonOk({ ok: true, verificationSent: true });
}
