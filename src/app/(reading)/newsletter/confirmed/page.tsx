import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Subscription confirmed — Quirin Schlegel",
  robots: { index: false },
};

export default function NewsletterConfirmedPage() {
  return (
    <article>
      <header className="article-head">
        <p className="eyebrow">Newsletter</p>
        <h1>You&apos;re subscribed 🎉</h1>
        <p className="subtitle">
          Thanks for confirming. You&apos;ll get a short email whenever a new six-pager is published.
        </p>
      </header>
      <p>
        In the meantime, browse the <Link href="/blog">six-pagers</Link> or wander{" "}
        <Link href="/vault">the vault</Link>. Every newsletter includes a one-click unsubscribe link.
      </p>
    </article>
  );
}
