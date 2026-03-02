"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { MessageCircle, Plus, Send } from "lucide-react";

import { AuthPanel } from "@/components/AuthPanel";
import { authClient } from "@/lib/auth-client";
import type { ThreadMessage, ThreadSummary } from "@/lib/types";

const configuredSecureTargets = [
  {
    id: "qs",
    label: "QS",
    email: process.env.NEXT_PUBLIC_SECURE_CHAT_QS_EMAIL ?? "",
    description: "Open a secure thread with Quirin.",
  },
  {
    id: "qsbot",
    label: "QSBot",
    email: process.env.NEXT_PUBLIC_SECURE_CHAT_QSBOT_EMAIL ?? "",
    description: "Open a secure thread with the bot identity.",
  },
] as const;

interface ThreadsResponse {
  threads: ThreadSummary[];
}

interface MessagesResponse {
  messages: ThreadMessage[];
}

interface CreateThreadResponse {
  thread: {
    id: string;
  };
}

interface SecureTarget {
  id: string;
  label: string;
  email: string;
  description: string;
}

interface CommsWorkspaceProps {
  embedded?: boolean;
}

export function CommsWorkspace({ embedded = false }: CommsWorkspaceProps) {
  const { data: session, isPending } = authClient.useSession();
  const [threads, setThreads] = useState<ThreadSummary[]>([]);
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ThreadMessage[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [newThreadEmail, setNewThreadEmail] = useState("");
  const [newThreadMessage, setNewThreadMessage] = useState("");
  const [draftMessage, setDraftMessage] = useState("");
  const [isCreatingThread, setIsCreatingThread] = useState(false);

  const signedIn = Boolean(session?.user?.id);
  const currentUserId = session?.user.id ?? "";
  const currentUserEmail =
    typeof session?.user?.email === "string" ? session.user.email.toLowerCase() : "";

  const secureTargets = useMemo(() => {
    const seenEmails = new Set<string>();
    const targets: SecureTarget[] = [];

    for (const target of configuredSecureTargets) {
      const normalized = target.email.trim().toLowerCase();
      if (!normalized || normalized === currentUserEmail || seenEmails.has(normalized)) {
        continue;
      }

      seenEmails.add(normalized);
      targets.push({
        ...target,
        email: normalized,
      });
    }

    return targets;
  }, [currentUserEmail]);

  async function loadThreads() {
    const response = await fetch("/api/comms/threads");
    if (!response.ok) {
      throw new Error(`Unable to load threads (${response.status})`);
    }

    const payload = (await response.json()) as ThreadsResponse;
    setThreads(payload.threads);
    setSelectedThreadId((previous) => previous ?? payload.threads[0]?.id ?? null);
  }

  async function loadMessages(threadId: string) {
    const response = await fetch(`/api/comms/threads/${threadId}/messages`);
    if (!response.ok) {
      throw new Error(`Unable to load messages (${response.status})`);
    }

    const payload = (await response.json()) as MessagesResponse;
    setMessages(payload.messages);
  }

  async function createThreadByEmail(targetUserEmail: string, initialMessage?: string): Promise<string | null> {
    try {
      const response = await fetch("/api/comms/threads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetUserEmail,
          initialMessage,
        }),
      });

      if (!response.ok) {
        const payload = (await response.json()) as { error?: { message?: string } };
        setStatus(payload.error?.message ?? "Unable to create thread.");
        return null;
      }

      const payload = (await response.json()) as CreateThreadResponse;
      const createdThreadId = payload.thread.id;

      await loadThreads();
      setSelectedThreadId(createdThreadId);
      await loadMessages(createdThreadId);

      return createdThreadId;
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Unable to create thread.");
      return null;
    }
  }

  useEffect(() => {
    if (!signedIn) return;

    let cancelled = false;

    (async () => {
      try {
        const response = await fetch("/api/comms/threads");
        if (!response.ok) {
          throw new Error(`Unable to load threads (${response.status})`);
        }

        const payload = (await response.json()) as ThreadsResponse;
        if (cancelled) return;
        setThreads(payload.threads);
        setSelectedThreadId((previous) => previous ?? payload.threads[0]?.id ?? null);
      } catch (error) {
        if (cancelled) return;
        setStatus(error instanceof Error ? error.message : "Unable to load threads.");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [signedIn]);

  useEffect(() => {
    if (!selectedThreadId || !signedIn) {
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const response = await fetch(`/api/comms/threads/${selectedThreadId}/messages`);
        if (!response.ok) {
          throw new Error(`Unable to load messages (${response.status})`);
        }

        const payload = (await response.json()) as MessagesResponse;
        if (cancelled) return;
        setMessages(payload.messages);
      } catch (error) {
        if (cancelled) return;
        setStatus(error instanceof Error ? error.message : "Unable to load messages.");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [selectedThreadId, signedIn]);

  const selectedThread = useMemo(
    () => threads.find((thread) => thread.id === selectedThreadId) ?? null,
    [threads, selectedThreadId],
  );

  async function onCreateThread(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus(null);
    if (!newThreadEmail.trim() || isCreatingThread) {
      return;
    }

    setIsCreatingThread(true);
    const createdThreadId = await createThreadByEmail(newThreadEmail.trim(), newThreadMessage || undefined);
    setIsCreatingThread(false);

    if (!createdThreadId) {
      return;
    }

    setNewThreadEmail("");
    setNewThreadMessage("");
  }

  async function onCreateSecureTargetThread(target: SecureTarget) {
    if (isCreatingThread) {
      return;
    }

    setStatus(null);
    setIsCreatingThread(true);
    const createdThreadId = await createThreadByEmail(target.email);
    setIsCreatingThread(false);

    if (!createdThreadId) {
      return;
    }

    setStatus(`Secure chat with ${target.label} is ready.`);
  }

  async function onSendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedThreadId || !draftMessage.trim()) {
      return;
    }

    const response = await fetch(`/api/comms/threads/${selectedThreadId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: draftMessage }),
    });

    if (!response.ok) {
      const payload = (await response.json()) as { error?: { message?: string } };
      setStatus(payload.error?.message ?? "Unable to send message.");
      return;
    }

    setDraftMessage("");
    await loadMessages(selectedThreadId);
    await loadThreads();
  }

  if (isPending) {
    return <p className="status-muted">Checking session...</p>;
  }

  if (!signedIn) {
    if (embedded) {
      return (
        <section className="panel comms-layout">
          <h2>Secure Chat</h2>
          <p className="status-muted">Use fingerprint secure access to unlock authenticated threads.</p>
        </section>
      );
    }

    return (
      <section className="panel">
        <h1>Comms</h1>
        <p className="status-muted">Sign in to access authenticated private threads.</p>
        <AuthPanel />
      </section>
    );
  }

  return (
    <section className="panel comms-layout">
      <div className="section-heading">
        <h1>Authenticated Comms</h1>
        <p>Private 1:1 threads with audit-backed exchange for QS and QSBot.</p>
      </div>

      {status ? <p className="status-error">{status}</p> : null}

      <div className="comms-grid">
        <aside className="comms-sidebar">
          <h2>
            <MessageCircle className="icon-sm" />
            Threads
          </h2>

          {secureTargets.length ? (
            <div className="secure-targets">
              <h3>Start Secure Chat</h3>
              <p className="status-muted">Choose QS for direct conversation or QSBot for automated replies.</p>
              <div className="secure-targets-grid">
                {secureTargets.map((target) => (
                  <button
                    key={target.id}
                    type="button"
                    className="secure-target-button"
                    onClick={() => void onCreateSecureTargetThread(target)}
                    disabled={isCreatingThread}
                    aria-label={`Start secure chat with ${target.label}`}
                  >
                    <strong>{target.label}</strong>
                    <span>{target.description}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          <ul>
            {threads.map((thread) => {
              const other = thread.participants.find((participant) => participant.id !== currentUserId);
              return (
                <li key={thread.id}>
                  <button
                    type="button"
                    className={thread.id === selectedThreadId ? "active" : ""}
                    onClick={() => setSelectedThreadId(thread.id)}
                  >
                    <strong>{other?.name ?? other?.email ?? "Unknown"}</strong>
                    <span>{thread.status}</span>
                  </button>
                </li>
              );
            })}
          </ul>

          <form className="inline-form" onSubmit={onCreateThread}>
            <label>
              Start New Thread
              <input
                type="email"
                required
                value={newThreadEmail}
                onChange={(event) => setNewThreadEmail(event.target.value)}
                placeholder="target@example.com"
                disabled={isCreatingThread}
              />
            </label>
            <textarea
              value={newThreadMessage}
              onChange={(event) => setNewThreadMessage(event.target.value)}
              placeholder="Optional first message"
              disabled={isCreatingThread}
            />
            <button type="submit" disabled={isCreatingThread}>
              <Plus className="icon-sm" />
              {isCreatingThread ? "Creating..." : "Create"}
            </button>
          </form>
        </aside>

        <div className="comms-thread">
          <header>
            <h2>{selectedThread ? `Thread ${selectedThread.id.slice(0, 8)}` : "Select a thread"}</h2>
            <p>{selectedThread ? `Status: ${selectedThread.status}` : ""}</p>
          </header>

          <div className="message-list">
            {messages.map((message) => {
              const mine = message.senderUserId === currentUserId;
              return (
                <article key={message.id} className={mine ? "message mine" : "message"}>
                  <span>{message.senderType}</span>
                  <p>{message.content}</p>
                  <time>{new Date(message.createdAt).toLocaleString("en-US")}</time>
                </article>
              );
            })}
          </div>

          {selectedThreadId ? (
            <form className="message-form" onSubmit={onSendMessage}>
              <textarea
                required
                value={draftMessage}
                onChange={(event) => setDraftMessage(event.target.value)}
                placeholder="Write a message"
              />
              <button type="submit">
                <Send className="icon-sm" />
                Send
              </button>
            </form>
          ) : null}
        </div>
      </div>
    </section>
  );
}
