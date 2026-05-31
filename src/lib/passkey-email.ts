import { writeAuditLog } from "@/lib/audit";
import { sendEmail } from "@/lib/email/client";
import { AssociateEmailVerifyEmail, PasskeyClaimEmail } from "@/lib/email/templates";
import { isBootstrapEmail } from "@/lib/identity";
import { consentVersion, requestNewsletterOptIn } from "@/lib/newsletter";
import { prisma } from "@/lib/prisma";
import { fingerprintSecret, makeSecret } from "@/lib/security";
import { absoluteUrl } from "@/lib/site";

import { Prisma } from "@prisma/client";

/**
 * Email-verification links for the passkey "associate your email" flow.
 *
 * Just after `addPasskey` succeeds the user's `User.email` is a synthetic
 * `passkey-<uuid>@local.invalid` placeholder. Rather than trust whatever
 * address they type, we email a single-use link (raw token; only its hash is
 * stored) and only act when it's clicked:
 *
 * - ASSOCIATE — the address is free: set the bootstrap user's verified email.
 * - CLAIM — the address already belongs to another account: move the
 *   freshly-registered passkey onto that account and delete the bootstrap user,
 *   so the user can sign in with the new passkey and land in their real account.
 */

export const CHAT_CONSENT_TEXT =
  "I agree my email may be stored and processed to enable secure chat. See the privacy policy.";

const LINK_TTL_MS = 30 * 60 * 1000; // 30 minutes

export function confirmLinkUrl(token: string): string {
  return absoluteUrl(`/api/auth/associate-email/confirm?token=${encodeURIComponent(token)}`);
}

interface CreateLinkInput {
  kind: "ASSOCIATE" | "CLAIM";
  bootstrapUserId: string;
  targetUserId?: string | null;
  email: string;
  newsletterOptIn: boolean;
  ipAddress?: string | null;
}

export type CreateLinkResult = { ok: true } | { ok: false; reason: "store" | "send" };

/**
 * Create a pending verification link and email it. Returns a discriminated
 * failure so callers can tell a database/store problem apart from an
 * email-delivery problem and surface the right message — never a silent
 * success that strands the user on a "check your inbox" screen.
 */
export async function createEmailVerificationLink(
  input: CreateLinkInput,
): Promise<CreateLinkResult> {
  const email = input.email.trim().toLowerCase();
  const token = makeSecret(32);

  try {
    await prisma.emailVerificationLink.create({
      data: {
        tokenHash: fingerprintSecret(token),
        kind: input.kind,
        bootstrapUserId: input.bootstrapUserId,
        targetUserId: input.targetUserId ?? null,
        email,
        newsletterOptIn: input.newsletterOptIn,
        consentText: CHAT_CONSENT_TEXT,
        consentVersion: consentVersion(),
        expiresAt: new Date(Date.now() + LINK_TTL_MS),
        ipAddress: input.ipAddress ?? null,
      },
    });
  } catch (error) {
    console.error("[passkey-email] failed to store verification link", error);
    return { ok: false, reason: "store" };
  }

  const confirmUrl = confirmLinkUrl(token);
  const sent = await sendEmail(
    input.kind === "CLAIM"
      ? {
          to: email,
          subject: "Attach a new passkey to your account",
          react: PasskeyClaimEmail({ confirmUrl }),
        }
      : {
          to: email,
          subject: "Confirm your email",
          react: AssociateEmailVerifyEmail({ confirmUrl }),
        },
  );

  return sent.ok ? { ok: true } : { ok: false, reason: "send" };
}

export type ConfirmResult = "associated" | "claimed" | "invalid" | "expired" | "taken";

/**
 * Consume a verification link. Single-use and idempotent under races: the link
 * is atomically marked consumed before any user record is touched.
 */
export async function confirmEmailVerificationLink(rawToken: string): Promise<ConfirmResult> {
  const tokenHash = fingerprintSecret(rawToken);
  const link = await prisma.emailVerificationLink.findUnique({ where: { tokenHash } });
  if (!link) {
    return "invalid";
  }
  if (link.consumedAt) {
    return "invalid";
  }
  if (link.expiresAt.getTime() < Date.now()) {
    await prisma.emailVerificationLink.updateMany({
      where: { id: link.id, consumedAt: null },
      data: { consumedAt: new Date() },
    });
    return "expired";
  }

  // Atomically claim the link so a second click can't replay it.
  const claimed = await prisma.emailVerificationLink.updateMany({
    where: { id: link.id, consumedAt: null },
    data: { consumedAt: new Date() },
  });
  if (claimed.count === 0) {
    return "invalid";
  }

  // The bootstrap user must still be a bootstrap user — if it already has a real
  // email (associated through another link), there's nothing left to do.
  const bootstrap = await prisma.user.findUnique({ where: { id: link.bootstrapUserId } });
  if (!bootstrap || !isBootstrapEmail(bootstrap.email)) {
    return "invalid";
  }

  if (link.kind === "ASSOCIATE") {
    const existing = await prisma.user.findUnique({
      where: { email: link.email },
      select: { id: true },
    });
    if (existing && existing.id !== bootstrap.id) {
      return "taken";
    }
    try {
      await prisma.user.update({
        where: { id: bootstrap.id },
        data: { email: link.email, emailVerified: true },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        return "taken";
      }
      throw error;
    }

    await maybeOptIn(link.newsletterOptIn, link.email, link.ipAddress);
    await writeAuditLog({
      actorUserId: bootstrap.id,
      action: "user.email_associated",
      targetType: "User",
      targetId: bootstrap.id,
      ipAddress: link.ipAddress,
      metadata: {
        email: link.email,
        consentText: link.consentText,
        consentVersion: link.consentVersion,
        newsletterOptIn: link.newsletterOptIn,
        verifiedViaLink: true,
      },
    });
    return "associated";
  }

  // CLAIM: move the bootstrap user's passkey(s) onto the existing account and
  // delete the now-empty bootstrap user. Re-validate the target by email in
  // case it changed since the link was issued.
  const target = await prisma.user.findUnique({
    where: { email: link.email },
    select: { id: true },
  });
  if (!target || target.id === bootstrap.id) {
    return "invalid";
  }

  await prisma.$transaction([
    prisma.passkey.updateMany({
      where: { userId: bootstrap.id },
      data: { userId: target.id },
    }),
    prisma.user.delete({ where: { id: bootstrap.id } }),
  ]);

  await maybeOptIn(link.newsletterOptIn, link.email, link.ipAddress);
  await writeAuditLog({
    actorUserId: target.id,
    action: "user.passkey_claimed",
    targetType: "User",
    targetId: target.id,
    ipAddress: link.ipAddress,
    metadata: {
      email: link.email,
      bootstrapUserId: bootstrap.id,
      consentText: link.consentText,
      consentVersion: link.consentVersion,
      newsletterOptIn: link.newsletterOptIn,
      verifiedViaLink: true,
    },
  });
  return "claimed";
}

async function maybeOptIn(
  optIn: boolean,
  email: string,
  ipAddress: string | null,
): Promise<void> {
  if (!optIn) {
    return;
  }
  await requestNewsletterOptIn({ email, source: "associate-email", ipAddress });
}
