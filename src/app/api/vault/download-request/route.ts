import { z } from "zod";

import { getPublishedNoteBySlug } from "@/lib/content/vault";
import { createDownloadToken } from "@/lib/download-token";
import { sendEmail } from "@/lib/email/client";
import { PdfDeliveryEmail } from "@/lib/email/templates";
import { jsonError, jsonOk } from "@/lib/http";
import { requestNewsletterOptIn } from "@/lib/newsletter";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, cleanupRateLimits } from "@/lib/rate-limit";
import { getRequestIp } from "@/lib/security";
import { absoluteUrl } from "@/lib/site";

const schema = z.object({
  email: z.string().email(),
  slug: z.string().min(1),
  consent: z.boolean(),
  newsletterOptIn: z.boolean().optional().default(false),
});

export async function POST(request: Request) {
  const ip = getRequestIp(request.headers);

  const rate = checkRateLimit(`download:${ip ?? "unknown"}`, 5, 60_000);
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
  const { email, slug, consent, newsletterOptIn } = parsed.data;
  if (!consent) {
    return jsonError("CONSENT_REQUIRED", "Please agree before we email your download link.", 400);
  }

  const note = getPublishedNoteBySlug(slug);
  if (!note || note.type !== "6-pager" || !note.pdf) {
    return jsonError("NOT_FOUND", "Unknown document.", 404);
  }

  const normalizedEmail = email.trim().toLowerCase();

  // Record the lead — lawful basis is delivering the requested file.
  await prisma.downloadLead.create({
    data: { email: normalizedEmail, slug, ipAddress: ip, newsletterOptIn },
  });

  // Email the tokenized, expiring download link (transactional).
  const token = createDownloadToken(normalizedEmail, slug);
  const downloadUrl = absoluteUrl(`/api/vault/download?token=${encodeURIComponent(token)}`);
  const sent = await sendEmail({
    to: normalizedEmail,
    subject: `Your PDF: ${note.title}`,
    react: PdfDeliveryEmail({ title: note.title, downloadUrl }),
  });

  // Separate, decoupled newsletter consent (double opt-in handled inside).
  if (newsletterOptIn) {
    await requestNewsletterOptIn({ email: normalizedEmail, source: `download:${slug}`, ipAddress: ip });
  }

  if (!sent.ok) {
    return jsonError("EMAIL_FAILED", sent.error ?? "We couldn't send the email right now. Please try again later.", 502);
  }

  return jsonOk({ ok: true });
}
