"use client";

import { useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Send } from "lucide-react";

interface Counts {
  pending: number;
  confirmed: number;
  unsubscribed: number;
}

interface BroadcastRow {
  id: string;
  subject: string;
  status: string;
  recipientCount: number | null;
  pagerSlug: string | null;
  sentAt: string | null;
  createdAt: string;
}

interface Pager {
  slug: string;
  title: string;
}

interface AdminNewsletterPanelProps {
  counts: Counts;
  broadcasts: BroadcastRow[];
  pagers: Pager[];
}

type Status = { kind: "idle" | "ok" | "err"; message?: string };

export function AdminNewsletterPanel({ counts, broadcasts, pagers }: AdminNewsletterPanelProps) {
  const router = useRouter();
  const [subject, setSubject] = useState("");
  const [pagerSlug, setPagerSlug] = useState("");
  const [body, setBody] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  const paragraphs = useMemo(
    () => body.split(/\n{2,}/).map((paragraph) => paragraph.trim()).filter(Boolean),
    [body],
  );

  function resetConfirm() {
    setConfirming(false);
  }

  async function send() {
    setSending(true);
    setStatus({ kind: "idle" });
    try {
      const response = await fetch("/api/admin/newsletter/broadcast", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ subject, bodyMarkdown: body, pagerSlug: pagerSlug || null }),
      });
      const data = (await response.json().catch(() => ({}))) as {
        error?: { message?: string };
        recipientCount?: number;
        failures?: number;
      };
      if (!response.ok) {
        setStatus({ kind: "err", message: data.error?.message ?? "Send failed." });
        return;
      }
      const failed = data.failures ? `, ${data.failures} failed` : "";
      setStatus({ kind: "ok", message: `Sent to ${data.recipientCount ?? 0} subscriber(s)${failed}.` });
      setSubject("");
      setBody("");
      setPagerSlug("");
      setConfirming(false);
      router.refresh();
    } catch {
      setStatus({ kind: "err", message: "Network error." });
    } finally {
      setSending(false);
    }
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!confirming) {
      setConfirming(true);
      return;
    }
    void send();
  }

  return (
    <div className="admin-news">
      <section className="panel">
        <p className="eyebrow">Newsletter</p>
        <h2>Subscribers</h2>
        <div className="news-stats">
          <div>
            <strong>{counts.confirmed}</strong>
            <span>confirmed</span>
          </div>
          <div>
            <strong>{counts.pending}</strong>
            <span>pending</span>
          </div>
          <div>
            <strong>{counts.unsubscribed}</strong>
            <span>unsubscribed</span>
          </div>
        </div>
      </section>

      <section className="panel">
        <h2>Compose broadcast</h2>
        <form onSubmit={onSubmit} className="news-form">
          <label>
            Subject
            <input
              value={subject}
              onChange={(event) => {
                setSubject(event.target.value);
                resetConfirm();
              }}
              required
              maxLength={200}
              placeholder="A new six-pager is out"
            />
          </label>
          <label>
            Link a six-pager (optional)
            <select
              value={pagerSlug}
              onChange={(event) => {
                setPagerSlug(event.target.value);
                resetConfirm();
              }}
            >
              <option value="">— none —</option>
              {pagers.map((pager) => (
                <option key={pager.slug} value={pager.slug}>
                  {pager.title}
                </option>
              ))}
            </select>
          </label>
          <label>
            Body
            <textarea
              value={body}
              onChange={(event) => {
                setBody(event.target.value);
                resetConfirm();
              }}
              required
              rows={8}
              placeholder="Write your update. Separate paragraphs with a blank line."
            />
          </label>

          {paragraphs.length > 0 ? (
            <div className="news-preview">
              <p className="eyebrow">Preview</p>
              {paragraphs.map((paragraph, index) => (
                <p key={index} style={{ fontWeight: index === 0 ? 600 : 400 }}>
                  {paragraph}
                </p>
              ))}
            </div>
          ) : null}

          <button type="submit" className="news-send" disabled={sending || !subject || !body}>
            <Send className="icon-sm" />
            {sending
              ? "Sending…"
              : confirming
                ? `Confirm: email ${counts.confirmed} subscriber(s)`
                : "Send broadcast"}
          </button>
          {confirming && !sending ? (
            <p className="news-hint">This emails all confirmed subscribers immediately. Click again to confirm.</p>
          ) : null}
          {status.kind !== "idle" ? (
            <p style={{ color: status.kind === "ok" ? "#7fe0a0" : "var(--danger)", fontWeight: 500 }} role="status">
              {status.message}
            </p>
          ) : null}
        </form>
      </section>

      <section className="panel">
        <h2>Recent broadcasts</h2>
        {broadcasts.length === 0 ? (
          <p>No broadcasts yet.</p>
        ) : (
          <ul className="news-list">
            {broadcasts.map((broadcast) => (
              <li key={broadcast.id}>
                <strong>{broadcast.subject}</strong>
                <span>
                  {broadcast.status}
                  {broadcast.recipientCount != null ? ` · ${broadcast.recipientCount} sent` : ""}
                  {broadcast.sentAt ? ` · ${broadcast.sentAt.slice(0, 10)}` : ""}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
