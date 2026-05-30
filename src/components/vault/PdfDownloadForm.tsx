"use client";

import { useState, type FormEvent } from "react";
import { Download } from "lucide-react";

interface PdfDownloadFormProps {
  slug: string;
  title: string;
}

type Status = { kind: "idle" | "ok" | "err"; message?: string };

/**
 * Email-gated PDF download. Leaving an email is the lawful basis for delivering
 * the requested file (transactional). The newsletter opt-in is a SEPARATE,
 * optional consent (DSGVO: no coupling) handled server-side via double opt-in.
 */
export function PdfDownloadForm({ slug, title }: PdfDownloadFormProps) {
  const [email, setEmail] = useState("");
  const [consent, setConsent] = useState(false);
  const [newsletterOptIn, setNewsletterOptIn] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) {
      return;
    }
    setSubmitting(true);
    setStatus({ kind: "idle" });
    try {
      const response = await fetch("/api/vault/download-request", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, slug, consent, newsletterOptIn }),
      });
      const data = (await response.json().catch(() => ({}))) as { error?: { message?: string } };
      if (!response.ok) {
        setStatus({ kind: "err", message: data.error?.message ?? "Something went wrong. Please try again." });
        return;
      }
      setStatus({
        kind: "ok",
        message: "Check your inbox — we've emailed you a download link for the PDF.",
      });
      setEmail("");
      setConsent(false);
      setNewsletterOptIn(false);
    } catch {
      setStatus({ kind: "err", message: "Network error. Please try again." });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="pdf-cta" aria-label={`Download ${title} as PDF`}>
      <h3>Download the print edition</h3>
      <p>Leave your email and we&apos;ll send you a link to the hand-set PDF of &ldquo;{title}.&rdquo;</p>
      <form className="pdf-form" onSubmit={onSubmit}>
        <input
          type="email"
          required
          placeholder="you@example.com"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          autoComplete="email"
        />
        <button type="submit" disabled={submitting || !consent}>
          <Download className="icon-sm" />
          {submitting ? "Sending…" : "Email me the PDF"}
        </button>
      </form>
      <label className="consent-row">
        <input
          type="checkbox"
          required
          checked={consent}
          onChange={(event) => setConsent(event.target.checked)}
        />
        <span>
          I agree my email may be used to send me this download link. See the{" "}
          <a href="/privacy">privacy policy</a>.
        </span>
      </label>
      <label className="consent-row">
        <input
          type="checkbox"
          checked={newsletterOptIn}
          onChange={(event) => setNewsletterOptIn(event.target.checked)}
        />
        <span>Also send me an email when a new six-pager is published (optional, double opt-in).</span>
      </label>
      {status.kind !== "idle" ? (
        <p className={`form-status ${status.kind}`} role="status">
          {status.message}
        </p>
      ) : null}
    </section>
  );
}
