import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AccountPanel } from "@/components/AccountPanel";
import { getServerSession } from "@/lib/auth-helpers";
import { isAdminEmail } from "@/lib/auth-helpers";
import { isBootstrapEmail } from "@/lib/identity";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = {
  title: "Account — Quirin Schlegel",
  robots: { index: false, follow: false },
};

export default async function AccountPage() {
  const session = await getServerSession();
  if (!session?.user?.id) {
    redirect("/?account=signin");
  }

  // The associate-email step needs to happen first — there's no useful account
  // surface for a bootstrap address, and a session with no real email at all
  // (e.g. an OAuth sign-in without a public address) must not reach the
  // subscriber lookup below, which would throw on `email.toLowerCase()`.
  if (!session.user.email || isBootstrapEmail(session.user.email)) {
    redirect("/?associate=1");
  }

  const [user, profile, subscriber] = await Promise.all([
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, email: true, name: true, createdAt: true, emailVerified: true },
    }),
    prisma.userProfile.findUnique({
      where: { userId: session.user.id },
      select: { displayName: true },
    }),
    prisma.subscriber.findUnique({
      where: { email: session.user.email.toLowerCase() },
      select: { status: true, confirmedAt: true, unsubscribedAt: true, createdAt: true },
    }),
  ]);

  if (!user) {
    redirect("/");
  }

  return (
    <AccountPanel
      initial={{
        user: {
          email: user.email,
          name: user.name,
          memberSince: user.createdAt.toISOString(),
          emailVerified: user.emailVerified,
        },
        profile: {
          displayName: profile?.displayName ?? user.name,
        },
        subscription: subscriber
          ? {
              status: subscriber.status,
              confirmedAt: subscriber.confirmedAt ? subscriber.confirmedAt.toISOString() : null,
              unsubscribedAt: subscriber.unsubscribedAt
                ? subscriber.unsubscribedAt.toISOString()
                : null,
              since: subscriber.createdAt.toISOString(),
            }
          : null,
        isAdmin: isAdminEmail(user.email),
      }}
    />
  );
}
