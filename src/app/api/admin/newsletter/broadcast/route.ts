import { z } from "zod";

import { writeAuditLog } from "@/lib/audit";
import { requireAdmin } from "@/lib/auth-helpers";
import { jsonError, jsonOk } from "@/lib/http";
import { sendBroadcast } from "@/lib/newsletter";
import { getRequestIp } from "@/lib/security";

const schema = z.object({
  subject: z.string().min(1).max(200),
  bodyMarkdown: z.string().min(1).max(20000),
  pagerSlug: z.string().nullable().optional(),
});

export async function POST(request: Request) {
  const auth = await requireAdmin(request);
  if (!auth.ok) {
    return auth.response;
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("BAD_REQUEST", "Invalid JSON body.", 400);
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return jsonError("VALIDATION", "A subject and body are required.", 400);
  }

  const result = await sendBroadcast({
    subject: parsed.data.subject,
    bodyMarkdown: parsed.data.bodyMarkdown,
    pagerSlug: parsed.data.pagerSlug ?? null,
    createdByUserId: auth.session.user.id,
    createdByEmail: auth.session.user.email,
  });

  await writeAuditLog({
    actorUserId: auth.session.user.id,
    action: "newsletter.broadcast",
    targetType: "NewsletterBroadcast",
    targetId: result.broadcastId,
    ipAddress: getRequestIp(request.headers),
    userAgent: request.headers.get("user-agent"),
    metadata: {
      recipientCount: result.recipientCount,
      failures: result.failures,
      pagerSlug: parsed.data.pagerSlug ?? null,
    },
  });

  return jsonOk(result);
}
