"use client";

import { useEffect, useState } from "react";
import { Archive, Bot, Check, RotateCcw } from "lucide-react";

import type { ThreadSummary } from "@/lib/types";

interface InboxResponse {
  threads: ThreadSummary[];
}

export function AdminInboxPanel() {
  const [threads, setThreads] = useState<ThreadSummary[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function loadInbox() {
    setLoading(true);
    const response = await fetch("/api/admin/inbox/threads");

    if (!response.ok) {
      const payload = (await response.json()) as { error?: { message?: string } };
      throw new Error(payload.error?.message ?? `Unable to load inbox (${response.status}).`);
    }

    const payload = (await response.json()) as InboxResponse;
    setThreads(payload.threads);
    setLoading(false);
  }

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const response = await fetch("/api/admin/inbox/threads");
        if (!response.ok) {
          const payload = (await response.json()) as { error?: { message?: string } };
          throw new Error(payload.error?.message ?? `Unable to load inbox (${response.status}).`);
        }

        const payload = (await response.json()) as InboxResponse;
        if (cancelled) return;
        setThreads(payload.threads);
      } catch (error) {
        if (cancelled) return;
        setStatus(error instanceof Error ? error.message : "Unable to load admin inbox.");
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  async function patchThread(threadId: string, body: Record<string, unknown>) {
    setStatus(null);

    const response = await fetch(`/api/admin/inbox/threads/${threadId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const payload = (await response.json()) as { error?: { message?: string } };
      setStatus(payload.error?.message ?? "Unable to update thread.");
      return;
    }

    await loadInbox();
  }

  return (
    <section className="panel">
      <div className="section-heading">
        <h1>Admin Inbox</h1>
        <p>Resolve or archive threads and toggle per-thread bot automation.</p>
      </div>

      {status ? <p className="status-error">{status}</p> : null}
      {loading ? <p className="status-muted">Loading inbox...</p> : null}

      <div className="admin-list">
        {threads.map((thread) => (
          <article key={thread.id} className="admin-item">
            <header>
              <h2>{thread.participants.map((participant) => participant.name).join(" / ")}</h2>
              <span>{thread.status}</span>
            </header>

            <p>{thread.lastMessage?.content ?? "No messages yet."}</p>

            <div className="admin-actions">
              <button type="button" onClick={() => patchThread(thread.id, { status: "OPEN" })}>
                <RotateCcw className="icon-sm" />
                Mark Open
              </button>
              <button type="button" onClick={() => patchThread(thread.id, { status: "RESOLVED" })}>
                <Check className="icon-sm" />
                Resolve
              </button>
              <button type="button" onClick={() => patchThread(thread.id, { status: "ARCHIVED" })}>
                <Archive className="icon-sm" />
                Archive
              </button>
              <button
                type="button"
                onClick={() =>
                  patchThread(thread.id, {
                    aiAutoReplyEnabled: !thread.aiAutoReplyEnabled,
                  })
                }
              >
                <Bot className="icon-sm" />
                {thread.aiAutoReplyEnabled ? "Disable AI" : "Enable AI"}
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
