"use client";

import { useState, type FormEvent } from "react";
import { Mail } from "lucide-react";

type Status = { kind: "idle" | "ok" | "err"; message?: string };

export function NewsletterSignup() {
  const [email, setEmail] = useState("");
  const [consent, setConsent] = useState(false);
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
      const response = await fetch("/api/newsletter/subscribe", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, consent }),
      });
      const data = (await response.json().catch(() => ({}))) as { error?: { message?: string } };
      if (!response.ok) {
        setStatus({ kind: "err", message: data.error?.message ?? "Something went wrong. Please try again." });
        return;
      }
      setStatus({
        kind: "ok",
        message: "Almost there — check your inbox and click the confirmation link to finish subscribing.",
      });
      setEmail("");
      setConsent(false);
    } catch {
      setStatus({ kind: "err", message: "Network error. Please try again." });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="pdf-form" onSubmit={onSubmit} style={{ flexDirection: "column", alignItems: "stretch" }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "10px" }}>
        <input
          type="email"
          required
          placeholder="you@example.com"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          autoComplete="email"
        />
        <button type="submit" disabled={submitting || !consent}>
          <Mail className="icon-sm" />
          {submitting ? "Sending…" : "Subscribe"}
        </button>
      </div>
      <label className="consent-row">
        <input type="checkbox" required checked={consent} onChange={(event) => setConsent(event.target.checked)} />
        <span>
          I agree to receive occasional emails about new six-pagers and understand I can unsubscribe at any time. See the{" "}
          <a href="/privacy">privacy policy</a>.
        </span>
      </label>
      {status.kind !== "idle" ? (
        <p className={`form-status ${status.kind}`} role="status">
          {status.message}
        </p>
      ) : null}
    </form>
  );
}
