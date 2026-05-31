import { z } from "zod";

import { requireUser } from "@/lib/auth-helpers";
import { jsonError, jsonOk } from "@/lib/http";
import { isBootstrapEmail } from "@/lib/identity";
import { requestNewsletterOptIn } from "@/lib/newsletter";
import { checkRateLimit, cleanupRateLimits } from "@/lib/rate-limit";
import { getRequestIp } from "@/lib/security";

const schema = z.object({
  consent: z.literal(true),
});

/**
 * Subscribe-from-account: re-uses the public newsletter double opt-in flow
 * with the signed-in user's email. Refuses bootstrap addresses (the synthetic
 * passkey-*@local.invalid placeholder is not a deliverable mailbox).
 */
export async function POST(request: Request) {
  const auth = await requireUser(request);
  if (!auth.ok) {
    return auth.response;
  }

  const email = auth.session.user.email;
  if (isBootstrapEmail(email)) {
    return jsonError(
      "EMAIL_NOT_ASSOCIATED",
      "Associate a real email with your passkey before subscribing.",
      409,
    );
  }

  const ip = getRequestIp(request.headers);
  const rate = checkRateLimit(`account-newsletter:${ip ?? auth.session.user.id}`, 5, 60_000);
  if (!rate.allowed) {
    return jsonError("RATE_LIMITED", "Too many requests. Please try again shortly.", 429);
  }
  cleanupRateLimits();

  try {
    schema.parse(await request.json());
  } catch {
    return jsonError(
      "CONSENT_REQUIRED",
      "Please tick the consent box before subscribing.",
      400,
    );
  }

  const result = await requestNewsletterOptIn({
    email,
    name: auth.session.user.name,
    source: "account-page",
    ipAddress: ip,
  });

  return jsonOk({ ok: result.ok, alreadyConfirmed: result.alreadyConfirmed });
}
