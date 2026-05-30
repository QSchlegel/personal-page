import { getPublishedNoteBySlug } from "@/lib/content/vault";
import { env } from "@/lib/env";
import { newsletterFrom, sendEmail } from "@/lib/email/client";
import { BroadcastEmail, DoubleOptInEmail } from "@/lib/email/templates";
import { prisma } from "@/lib/prisma";
import { makeSecret } from "@/lib/security";
import { absoluteUrl } from "@/lib/site";

export const NEWSLETTER_CONSENT_TEXT =
  "I agree to receive the Quirin Schlegel six-pager newsletter (occasional emails about new releases) and understand I can unsubscribe at any time.";

export function consentVersion(): string {
  return env.NEWSLETTER_CONSENT_VERSION;
}

export function confirmUrl(token: string): string {
  return absoluteUrl(`/api/newsletter/confirm?token=${encodeURIComponent(token)}`);
}

export function unsubscribeUrl(token: string): string {
  return absoluteUrl(`/api/newsletter/unsubscribe?token=${encodeURIComponent(token)}`);
}

interface OptInInput {
  email: string;
  name?: string | null;
  source: string;
  ipAddress?: string | null;
}

/**
 * Create or refresh a PENDING subscriber and send the double opt-in email.
 * Returns alreadyConfirmed (no email sent) if the address is already CONFIRMED.
 * DSGVO: the address is only added to the active list after the user confirms.
 */
export async function requestNewsletterOptIn(input: OptInInput): Promise<{ ok: boolean; alreadyConfirmed: boolean }> {
  const email = input.email.trim().toLowerCase();
  const existing = await prisma.subscriber.findUnique({ where: { email } });

  if (existing?.status === "CONFIRMED") {
    return { ok: true, alreadyConfirmed: true };
  }

  const confirmToken = makeSecret(24);
  const subscriber = existing
    ? await prisma.subscriber.update({
        where: { email },
        data: {
          status: "PENDING",
          confirmToken,
          name: input.name ?? existing.name,
          source: input.source,
          ipAddress: input.ipAddress ?? existing.ipAddress,
          consentText: NEWSLETTER_CONSENT_TEXT,
          consentVersion: consentVersion(),
          unsubscribedAt: null,
        },
      })
    : await prisma.subscriber.create({
        data: {
          email,
          name: input.name ?? null,
          status: "PENDING",
          confirmToken,
          unsubscribeToken: makeSecret(24),
          consentText: NEWSLETTER_CONSENT_TEXT,
          consentVersion: consentVersion(),
          source: input.source,
          ipAddress: input.ipAddress ?? null,
        },
      });

  await sendEmail({
    to: subscriber.email,
    from: newsletterFrom(),
    subject: "Confirm your subscription",
    react: DoubleOptInEmail({ confirmUrl: confirmUrl(confirmToken) }),
  });

  return { ok: true, alreadyConfirmed: false };
}

export async function confirmSubscriber(token: string): Promise<boolean> {
  const subscriber = await prisma.subscriber.findUnique({ where: { confirmToken: token } });
  if (!subscriber) {
    return false;
  }
  await prisma.subscriber.update({
    where: { id: subscriber.id },
    data: { status: "CONFIRMED", confirmedAt: new Date(), confirmToken: null },
  });
  return true;
}

export async function unsubscribeByToken(token: string): Promise<boolean> {
  const subscriber = await prisma.subscriber.findUnique({ where: { unsubscribeToken: token } });
  if (!subscriber) {
    return false;
  }
  await prisma.subscriber.update({
    where: { id: subscriber.id },
    data: { status: "UNSUBSCRIBED", unsubscribedAt: new Date() },
  });
  return true;
}

export async function getSubscriberCounts(): Promise<{ pending: number; confirmed: number; unsubscribed: number }> {
  const grouped = await prisma.subscriber.groupBy({ by: ["status"], _count: true });
  const counts = { pending: 0, confirmed: 0, unsubscribed: 0 };
  for (const row of grouped) {
    if (row.status === "PENDING") {
      counts.pending = row._count;
    } else if (row.status === "CONFIRMED") {
      counts.confirmed = row._count;
    } else if (row.status === "UNSUBSCRIBED") {
      counts.unsubscribed = row._count;
    }
  }
  return counts;
}

interface SendBroadcastInput {
  subject: string;
  bodyMarkdown: string;
  pagerSlug?: string | null;
  createdByUserId?: string | null;
  createdByEmail?: string | null;
}

export interface BroadcastResult {
  broadcastId: string;
  recipientCount: number;
  failures: number;
}

/**
 * Send a broadcast to every CONFIRMED subscriber. Manual-trigger only (called
 * from the admin route). Each email carries that subscriber's own one-click
 * unsubscribe link + List-Unsubscribe headers, and a per-recipient delivery row
 * is written for accountability.
 */
export async function sendBroadcast(input: SendBroadcastInput): Promise<BroadcastResult> {
  let articleUrl: string | undefined;
  let articleTitle: string | undefined;
  if (input.pagerSlug) {
    const note = getPublishedNoteBySlug(input.pagerSlug);
    if (note?.type === "6-pager") {
      articleUrl = absoluteUrl(note.url);
      articleTitle = note.title;
    }
  }

  const paragraphs = input.bodyMarkdown
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);

  const broadcast = await prisma.newsletterBroadcast.create({
    data: {
      subject: input.subject,
      bodyMarkdown: input.bodyMarkdown,
      pagerSlug: input.pagerSlug ?? null,
      status: "SENDING",
      createdByUserId: input.createdByUserId ?? null,
      createdByEmail: input.createdByEmail ?? null,
    },
  });

  const subscribers = await prisma.subscriber.findMany({ where: { status: "CONFIRMED" } });
  let failures = 0;

  for (const subscriber of subscribers) {
    const unsub = unsubscribeUrl(subscriber.unsubscribeToken);
    const sent = await sendEmail({
      to: subscriber.email,
      from: newsletterFrom(),
      subject: input.subject,
      react: BroadcastEmail({ paragraphs, articleUrl, articleTitle, unsubscribeUrl: unsub }),
      headers: {
        "List-Unsubscribe": `<${unsub}>`,
        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
      },
    });
    await prisma.newsletterSend.create({
      data: {
        broadcastId: broadcast.id,
        subscriberId: subscriber.id,
        email: subscriber.email,
        status: sent.ok ? "SUCCESS" : "FAILED",
        error: sent.ok ? null : (sent.error ?? "unknown error"),
      },
    });
    if (!sent.ok) {
      failures += 1;
    }
  }

  await prisma.newsletterBroadcast.update({
    where: { id: broadcast.id },
    data: {
      status: subscribers.length > 0 && failures === subscribers.length ? "FAILED" : "SENT",
      recipientCount: subscribers.length,
      sentAt: new Date(),
    },
  });

  return { broadcastId: broadcast.id, recipientCount: subscribers.length, failures };
}

export async function getRecentBroadcasts(limit = 10) {
  return prisma.newsletterBroadcast.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      subject: true,
      status: true,
      recipientCount: true,
      pagerSlug: true,
      sentAt: true,
      createdAt: true,
    },
  });
}
