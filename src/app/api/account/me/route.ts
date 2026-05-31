import { requireUser } from "@/lib/auth-helpers";
import { jsonOk } from "@/lib/http";
import { isBootstrapEmail } from "@/lib/identity";
import { isAdminEmail } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";

/**
 * Small "tell me about me" endpoint that the client uses to hydrate UI
 * decisions which depend on server-only state (admin status) or that would
 * otherwise require a Prisma query in every component (newsletter status).
 *
 * Kept deliberately small — never returns sensitive data and never leaks
 * the admin allowlist itself. The boolean `isAdmin` is derived server-side
 * from `ADMIN_EMAIL_ALLOWLIST`, never trusted from the client.
 */
export async function GET(request: Request) {
  const auth = await requireUser(request);
  if (!auth.ok) {
    return auth.response;
  }

  const email = auth.session.user.email;

  // A session without a real email (bootstrap passkey, or an OAuth sign-in
  // with no public address) has nothing to look up — guard before
  // `email.toLowerCase()`, which would otherwise throw a 500.
  if (!email || isBootstrapEmail(email)) {
    return jsonOk({
      isAdmin: false,
      isBootstrap: true,
      subscription: null,
    });
  }

  const subscriber = await prisma.subscriber.findUnique({
    where: { email: email.toLowerCase() },
    select: { status: true, confirmedAt: true, unsubscribedAt: true, createdAt: true },
  });

  return jsonOk({
    isAdmin: isAdminEmail(email),
    isBootstrap: isBootstrapEmail(email),
    subscription: subscriber
      ? {
          status: subscriber.status,
          confirmedAt: subscriber.confirmedAt ? subscriber.confirmedAt.toISOString() : null,
          unsubscribedAt: subscriber.unsubscribedAt ? subscriber.unsubscribedAt.toISOString() : null,
          createdAt: subscriber.createdAt.toISOString(),
        }
      : null,
  });
}
