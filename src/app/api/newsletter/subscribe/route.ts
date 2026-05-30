import { z } from "zod";

import { jsonError, jsonOk } from "@/lib/http";
import { requestNewsletterOptIn } from "@/lib/newsletter";
import { checkRateLimit, cleanupRateLimits } from "@/lib/rate-limit";
import { getRequestIp } from "@/lib/security";

const schema = z.object({
  email: z.string().email(),
  name: z.string().max(120).optional(),
  consent: z.boolean(),
});

export async function POST(request: Request) {
  const ip = getRequestIp(request.headers);

  const rate = checkRateLimit(`subscribe:${ip ?? "unknown"}`, 5, 60_000);
  if (!rate.allowed) {
    return jsonError("RATE_LIMITED", "Too many requests. Please try again shortly.", 429);
  }
  cleanupRateLimits();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("BAD_REQUEST", "Invalid JSON body.", 400);
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return jsonError("VALIDATION", "Please provide a valid email address.", 400);
  }
  const { email, name, consent } = parsed.data;
  if (!consent) {
    return jsonError("CONSENT_REQUIRED", "Please tick the consent box to subscribe.", 400);
  }

  await requestNewsletterOptIn({ email, name, source: "newsletter-page", ipAddress: ip });

  // Respond generically — never reveal whether an address is already on the list.
  return jsonOk({ ok: true });
}
