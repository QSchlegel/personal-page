"use client";

import { FormEvent, useEffect, useState } from "react";
import { Archive, Bot, Check, MessageSquare, RotateCcw, Send } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

import { authClient } from "@/lib/auth-client";
import { easingStandard } from "@/lib/motion";
import type { ThreadMessage, ThreadSummary } from "@/lib/types";

interface InboxResponse {
  threads: ThreadSummary[];
}

export function AdminInboxPanel({ showPageHeading = true }: { showPageHeading?: boolean }) {
  const { data: session } = authClient.useSession();
  const myUserId = session?.user?.id ?? null;

  const [threads, setThreads] = useState<ThreadSummary[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const reduceMotion = useReducedMotion();

  const [openThreadId, setOpenThreadId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ThreadMessage[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);

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

  async function loadMessages(threadId: string) {
    setMessagesLoading(true);
    try {
      const response = await fetch(`/api/admin/inbox/threads/${threadId}/messages`);
      if (!response.ok) {
        const payload = (await response.json()) as { error?: { message?: string } };
        throw new Error(payload.error?.message ?? "Unable to load messages.");
      }
      const payload = (await response.json()) as { messages: ThreadMessage[] };
      setMessages(payload.messages);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Unable to load messages.");
    } finally {
      setMessagesLoading(false);
    }
  }

  function openThread(threadId: string) {
    if (openThreadId === threadId) {
      setOpenThreadId(null);
      setMessages([]);
      return;
    }
    setStatus(null);
    setDraft("");
    setOpenThreadId(threadId);
    setMessages([]);
    void loadMessages(threadId);
  }

  async function sendReply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!openThreadId || sending) return;
    const content = draft.trim();
    if (!content) return;

    setSending(true);
    setStatus(null);
    try {
      const response = await fetch(`/api/admin/inbox/threads/${openThreadId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      if (!response.ok) {
        const payload = (await response.json()) as { error?: { message?: string } };
        throw new Error(payload.error?.message ?? "Unable to send reply.");
      }
      setDraft("");
      await loadMessages(openThreadId);
      await loadInbox();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Unable to send reply.");
    } finally {
      setSending(false);
    }
  }

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

  function senderLabel(message: ThreadMessage, otherName: string): string {
    if (message.senderType === "BOT") return "Assistant";
    if (message.senderType === "SYSTEM") return "System";
    if (myUserId && message.senderUserId === myUserId) return "You";
    return otherName;
  }

  return (
    <motion.section
      className="panel"
      initial={false}
      animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: easingStandard }}
    >
      {showPageHeading ? (
        <div className="section-heading">
          <h1>Admin Inbox</h1>
          <p>Read and answer conversations, resolve or archive threads, and toggle per-thread bot automation.</p>
        </div>
      ) : null}

      <AnimatePresence>
        {status ? (
          <motion.p
            className="status-error"
            initial={false}
            animate={reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -8 }}
          >
            {status}
          </motion.p>
        ) : null}
      </AnimatePresence>
      {loading ? <p className="status-muted">Loading inbox...</p> : null}

      <div className="admin-list">
        {threads.length > 0 ? (
          threads.map((thread, index) => {
            const otherName =
              thread.participants.map((participant) => participant.name).join(" / ") || "Visitor";
            const isOpen = openThreadId === thread.id;
            return (
              <motion.article
                key={thread.id}
                className="admin-item"
                initial={false}
                animate={reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
                transition={{ duration: 0.25, delay: index * 0.03 }}
              >
                <header>
                  <h2>{otherName}</h2>
                  <span>{thread.status}</span>
                </header>

                <p>{thread.lastMessage?.content ?? "No messages yet."}</p>

                <div className="admin-actions">
                  <button type="button" onClick={() => openThread(thread.id)}>
                    <MessageSquare className="icon-sm" />
                    {isOpen ? "Close" : "View / Reply"}
                  </button>
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

                {isOpen ? (
                  <div className="admin-thread">
                    {messagesLoading ? (
                      <p className="status-muted">Loading conversation…</p>
                    ) : messages.length > 0 ? (
                      <ul className="admin-messages">
                        {messages.map((message) => (
                          <li key={message.id} className="admin-message">
                            <span className="admin-message-sender">{senderLabel(message, otherName)}</span>
                            <span className="admin-message-body">{message.content}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="status-muted">No messages yet.</p>
                    )}

                    <form className="admin-reply" onSubmit={sendReply}>
                      <textarea
                        value={draft}
                        onChange={(event) => setDraft(event.target.value)}
                        placeholder="Write a reply…"
                        rows={3}
                        maxLength={4000}
                        disabled={sending}
                      />
                      <button type="submit" disabled={sending || !draft.trim()}>
                        <Send className="icon-sm" />
                        {sending ? "Sending…" : "Send reply"}
                      </button>
                    </form>
                  </div>
                ) : null}
              </motion.article>
            );
          })
        ) : (
          <p className="status-muted">No admin threads available right now.</p>
        )}
      </div>
    </motion.section>
  );
}
