import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AdminNewsletterPanel } from "@/components/AdminNewsletterPanel";
import { getServerSession, isAdminEmail } from "@/lib/auth-helpers";
import { getSixPagers } from "@/lib/content/vault";
import { getRecentBroadcasts, getSubscriberCounts } from "@/lib/newsletter";

export const metadata: Metadata = {
  title: "Newsletter Admin — Quirin Schlegel",
  robots: { index: false },
};

export default async function AdminNewsletterPage() {
  const session = await getServerSession();
  if (!session || !isAdminEmail(session.user.email)) {
    redirect("/");
  }

  const [counts, broadcasts] = await Promise.all([getSubscriberCounts(), getRecentBroadcasts()]);
  const pagers = getSixPagers().map((note) => ({ slug: note.slug, title: note.title }));

  const serializedBroadcasts = broadcasts.map((broadcast) => ({
    id: broadcast.id,
    subject: broadcast.subject,
    status: broadcast.status,
    recipientCount: broadcast.recipientCount,
    pagerSlug: broadcast.pagerSlug,
    sentAt: broadcast.sentAt ? broadcast.sentAt.toISOString() : null,
    createdAt: broadcast.createdAt.toISOString(),
  }));

  return <AdminNewsletterPanel counts={counts} broadcasts={serializedBroadcasts} pagers={pagers} />;
}
