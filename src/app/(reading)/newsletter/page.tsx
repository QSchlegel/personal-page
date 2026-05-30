import type { Metadata } from "next";

import { NewsletterSignup } from "@/components/vault/NewsletterSignup";

export const metadata: Metadata = {
  title: "Newsletter — Quirin Schlegel",
  description: "Get an email whenever a new six-pager is published. Double opt-in, no spam, unsubscribe anytime.",
  alternates: { canonical: "/newsletter" },
};

interface NewsletterPageProps {
  searchParams: Promise<{ status?: string }>;
}

export default async function NewsletterPage({ searchParams }: NewsletterPageProps) {
  const { status } = await searchParams;

  return (
    <article>
      <header className="article-head">
        <p className="eyebrow">Knowledge Vault</p>
        <h1>The newsletter</h1>
        <p className="subtitle">
          One short email when a new six-pager lands — nothing else. Double opt-in, and one-click unsubscribe in every
          message.
        </p>
      </header>

      {status === "invalid" ? (
        <p className="form-status err" role="status">
          That confirmation link is invalid or has expired. Please subscribe again below.
        </p>
      ) : null}

      <div className="pdf-cta">
        <h3>Subscribe</h3>
        <p>We&apos;ll email you a confirmation link first — you&apos;re only added once you click it.</p>
        <NewsletterSignup />
      </div>

      <p style={{ marginTop: "1.4em" }}>
        Your address is used only to send the newsletter and is processed by our email provider on our behalf. See the{" "}
        <a href="/privacy">privacy policy</a> for details and your rights, including erasure.
      </p>
    </article>
  );
}
