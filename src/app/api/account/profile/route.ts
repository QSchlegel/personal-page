import { z } from "zod";

import { writeAuditLog } from "@/lib/audit";
import { requireUser } from "@/lib/auth-helpers";
import { jsonError, jsonOk } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, cleanupRateLimits } from "@/lib/rate-limit";
import { getRequestIp } from "@/lib/security";

const schema = z.object({
  displayName: z
    .string()
    .trim()
    .min(1, "Please choose a name.")
    .max(80, "Names must be 80 characters or fewer."),
});

/**
 * Update the signed-in user's profile (display name only for now). We use
 * the existing UserProfile model so we don't disturb better-auth's User.name
 * (which is set by the bootstrap flow and would be confusing to mutate).
 */
export async function POST(request: Request) {
  const auth = await requireUser(request);
  if (!auth.ok) {
    return auth.response;
  }

  const ip = getRequestIp(request.headers);
  const rate = checkRateLimit(`account-profile:${ip ?? auth.session.user.id}`, 12, 60_000);
  if (!rate.allowed) {
    return jsonError("RATE_LIMITED", "Too many updates. Please slow down.", 429);
  }
  cleanupRateLimits();

  let body: z.infer<typeof schema>;
  try {
    body = schema.parse(await request.json());
  } catch (error) {
    if (error instanceof z.ZodError) {
      return jsonError("VALIDATION", error.issues[0]?.message ?? "Invalid payload.", 400);
    }
    return jsonError("VALIDATION", "Invalid payload.", 400);
  }

  const displayName = body.displayName.trim();

  await prisma.userProfile.upsert({
    where: { userId: auth.session.user.id },
    create: { userId: auth.session.user.id, displayName },
    update: { displayName },
  });

  await writeAuditLog({
    actorUserId: auth.session.user.id,
    action: "user.profile_updated",
    targetType: "UserProfile",
    targetId: auth.session.user.id,
    ipAddress: ip,
    userAgent: request.headers.get("user-agent"),
    metadata: { displayName },
  });

  return jsonOk({ ok: true, displayName });
}
