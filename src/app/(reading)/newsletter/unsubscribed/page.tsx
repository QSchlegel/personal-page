import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Unsubscribed — Quirin Schlegel",
  robots: { index: false },
};

export default function NewsletterUnsubscribedPage() {
  return (
    <article>
      <header className="masthead">
        <p className="eyebrow">Newsletter</p>
        <h1>You&apos;ve been unsubscribed</h1>
        <p className="subtitle">You won&apos;t receive any more newsletter emails. No hard feelings.</p>
      </header>
      <p>
        Changed your mind? You can <Link href="/newsletter">subscribe again</Link> anytime. To have your data erased
        entirely, see the <Link href="/privacy">privacy policy</Link>.
      </p>
    </article>
  );
}
