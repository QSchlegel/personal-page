"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { Bot, ChevronLeft, MessageCircle, Plus, Send, User } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

import { AuthPanel } from "@/components/AuthPanel";
import { cardReveal, easingStandard, springSoft } from "@/lib/motion";
import { authClient } from "@/lib/auth-client";
import { friendlyStatus, participantName, senderLabel } from "@/lib/comms-display";
import type { SecureTargetKind } from "@/lib/comms-display";
import type { ThreadMessage, ThreadSummary } from "@/lib/types";

const configuredSecureTargets = [
  {
    id: "qs",
    kind: "person",
    label: "Quirin",
    email: process.env.NEXT_PUBLIC_SECURE_CHAT_QS_EMAIL ?? "",
    description: "Message me directly — I'll reply when I'm around.",
  },
  {
    id: "qsbot",
    kind: "ai",
    label: "AI Assistant",
    email: process.env.NEXT_PUBLIC_SECURE_CHAT_QSBOT_EMAIL ?? "",
    description: "Ask my AI assistant — usually replies right away.",
  },
] as const satisfies ReadonlyArray<{
  id: string;
  kind: SecureTargetKind;
  label: string;
  email: string;
  description: string;
}>;

/** While a thread is open and the tab is visible, refetch every N ms. */
const MESSAGE_POLL_MS = 5_000;

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

interface ApiError {
  code?: string;
  message?: string;
}

interface SecureTarget {
  id: string;
  kind: SecureTargetKind;
  label: string;
  email: string;
  description: string;
  /** AI target whose email isn't configured yet — render disabled. */
  comingSoon?: boolean;
}

interface CommsWorkspaceProps {
  embedded?: boolean;
  showPageHeading?: boolean;
  /** Called when the server reports EMAIL_NOT_ASSOCIATED so the parent can route to the associate-email step. */
  onEmailNotAssociated?: () => void;
}

interface PendingMessage extends ThreadMessage {
  pending?: boolean;
  failed?: boolean;
}

function tmpId(): string {
  return `tmp_${Math.random().toString(36).slice(2, 10)}_${performance.now().toString(36)}`;
}

export function CommsWorkspace({
  embedded = false,
  showPageHeading = true,
  onEmailNotAssociated,
}: CommsWorkspaceProps) {
  const { data: session, isPending } = authClient.useSession();
  const [threads, setThreads] = useState<ThreadSummary[]>([]);
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [messages, setMessages] = useState<PendingMessage[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [newThreadEmail, setNewThreadEmail] = useState("");
  const [newThreadMessage, setNewThreadMessage] = useState("");
  const [draftMessage, setDraftMessage] = useState("");
  const [isCreatingThread, setIsCreatingThread] = useState(false);
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const reduceMotion = useReducedMotion();

  const signedIn = Boolean(session?.user?.id);
  const currentUserId = session?.user.id ?? "";
  const currentUserEmail =
    typeof session?.user?.email === "string" ? session.user.email.toLowerCase() : "";

  const secureTargets = useMemo(() => {
    const seenEmails = new Set<string>();
    const targets: SecureTarget[] = [];

    for (const target of configuredSecureTargets) {
      const normalized = target.email.trim().toLowerCase();

      // An AI target with no configured email still gets a "coming soon"
      // placeholder so the option is visible; a person target without an email
      // (or one that resolves to the viewer themselves) is dropped entirely.
      if (!normalized) {
        if (target.kind === "ai") {
          targets.push({ ...target, email: "", comingSoon: true });
        }
        continue;
      }

      if (normalized === currentUserEmail || seenEmails.has(normalized)) {
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

  // A target the viewer can actually click (excludes "coming soon" placeholders).
  const hasActionableTarget = useMemo(
    () => secureTargets.some((target) => !target.comingSoon),
    [secureTargets],
  );

  // True when the viewer is one of the configured identities (e.g. the owner),
  // so the empty-state copy can explain that incoming threads land here.
  const ownerIsViewer = useMemo(
    () =>
      currentUserEmail !== "" &&
      configuredSecureTargets.some(
        (target) => target.email.trim().toLowerCase() === currentUserEmail,
      ),
    [currentUserEmail],
  );

  // -- shared response handling -------------------------------------------------
  const handleAuthError = useCallback(
    (code: string | undefined, fallback: string): string => {
      if (code === "EMAIL_NOT_ASSOCIATED") {
        onEmailNotAssociated?.();
        return "Associate a real email with your passkey to continue.";
      }
      return fallback;
    },
    [onEmailNotAssociated],
  );

  // -- threads list -------------------------------------------------------------
  const loadThreads = useCallback(async () => {
    const response = await fetch("/api/comms/threads");
    if (!response.ok) {
      const payload = (await response.json().catch(() => ({}))) as { error?: ApiError };
      throw new Error(handleAuthError(payload.error?.code, `Unable to load threads (${response.status})`));
    }
    const payload = (await response.json()) as ThreadsResponse;
    setThreads(payload.threads);
    // Don't auto-open the first thread: on mobile the workspace shows one pane
    // at a time, so the user should land on the list/contact view, not be
    // dropped straight into a conversation.
    setSelectedThreadId((previous) => previous ?? null);
  }, [handleAuthError]);

  // -- messages list (also the polling tick) ------------------------------------
  const loadMessages = useCallback(
    async (threadId: string, options: { silent?: boolean } = {}) => {
      const response = await fetch(`/api/comms/threads/${threadId}/messages`);
      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: ApiError };
        const message = handleAuthError(payload.error?.code, `Unable to load messages (${response.status})`);
        if (!options.silent) {
          setStatus(message);
        }
        return;
      }
      const payload = (await response.json()) as MessagesResponse;
      // Preserve any pending-but-not-yet-acknowledged outgoing messages so
      // the user's draft doesn't visibly disappear on the next poll.
      setMessages((prev) => {
        const pendingTail = prev.filter((m) => m.pending && !payload.messages.some((s) => s.id === m.id));
        return [...payload.messages, ...pendingTail];
      });
    },
    [handleAuthError],
  );

  // -- effect: initial threads fetch + thread-list refresh on resetKey ---------
  useEffect(() => {
    if (!signedIn) return;
    let cancelled = false;
    (async () => {
      try {
        await loadThreads();
      } catch (error) {
        if (!cancelled) {
          setStatus(error instanceof Error ? error.message : "Unable to load threads.");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [signedIn, loadThreads]);

  // -- effect: poll messages while a thread is open + tab visible --------------
  useEffect(() => {
    if (!selectedThreadId || !signedIn) return;

    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | null = null;

    const tick = () => {
      if (cancelled) return;
      if (typeof document !== "undefined" && document.visibilityState === "hidden") {
        return;
      }
      void loadMessages(selectedThreadId, { silent: true });
    };

    // initial load — surface errors
    void (async () => {
      try {
        await loadMessages(selectedThreadId);
      } catch (error) {
        if (!cancelled) {
          setStatus(error instanceof Error ? error.message : "Unable to load messages.");
        }
      }
    })();

    timer = setInterval(tick, MESSAGE_POLL_MS);
    const onVisibility = () => {
      // Catch up immediately when the tab regains focus.
      if (typeof document !== "undefined" && document.visibilityState === "visible") {
        tick();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [selectedThreadId, signedIn, loadMessages]);

  const selectedThread = useMemo(
    () => threads.find((thread) => thread.id === selectedThreadId) ?? null,
    [threads, selectedThreadId],
  );

  // -- thread create -----------------------------------------------------------
  const createThreadByEmail = useCallback(
    async (targetUserEmail: string, initialMessage?: string): Promise<string | null> => {
      try {
        const response = await fetch("/api/comms/threads", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ targetUserEmail, initialMessage }),
        });

        if (!response.ok) {
          const payload = (await response.json().catch(() => ({}))) as { error?: ApiError };
          const code = payload.error?.code;
          if (code === "USER_NOT_FOUND") {
            setStatus(
              `No account exists for ${targetUserEmail}. They need to register a passkey first.`,
            );
          } else if (code === "INVALID_TARGET") {
            setStatus("That's your own address — pick someone else to message.");
          } else {
            setStatus(handleAuthError(code, payload.error?.message ?? "Unable to create thread."));
          }
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
    },
    [handleAuthError, loadMessages, loadThreads],
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
      // Keep what the user typed so they can correct + retry.
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
    if (createdThreadId) {
      setStatus(`Secure chat with ${target.label} is ready.`);
    }
  }

  // -- optimistic send ---------------------------------------------------------
  async function onSendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus(null);

    const trimmed = draftMessage.trim();
    if (!selectedThreadId || !trimmed || isSendingMessage) {
      return;
    }

    setIsSendingMessage(true);

    // Optimistically append the message; reconcile when the server replies.
    const optimistic: PendingMessage = {
      id: tmpId(),
      threadId: selectedThreadId,
      senderType: "USER",
      senderUserId: currentUserId,
      senderBotId: null,
      content: trimmed,
      moderated: false,
      createdAt: new Date().toISOString(),
      pending: true,
    };
    setMessages((prev) => [...prev, optimistic]);

    try {
      const response = await fetch(`/api/comms/threads/${selectedThreadId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: trimmed }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: ApiError };
        // Keep the draft so the user can retry without re-typing.
        setMessages((prev) =>
          prev.map((m) => (m.id === optimistic.id ? { ...m, pending: false, failed: true } : m)),
        );
        setStatus(handleAuthError(payload.error?.code, payload.error?.message ?? "Unable to send message."));
        return;
      }

      // Clear draft only AFTER the server accepted the message.
      setDraftMessage("");
      // Drop the placeholder BEFORE refetch — the server returns the real row
      // with its own id, so loadMessages's preservePending filter would keep
      // the tmp_* row forever (visible as a permanent "sending…" duplicate).
      setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
      await loadMessages(selectedThreadId, { silent: true });
      void loadThreads();
    } catch (error) {
      setMessages((prev) =>
        prev.map((m) => (m.id === optimistic.id ? { ...m, pending: false, failed: true } : m)),
      );
      setStatus(error instanceof Error ? error.message : "Unable to send message.");
    } finally {
      setIsSendingMessage(false);
    }
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
        {showPageHeading ? <h1>Comms</h1> : null}
        <p className="status-muted">Sign in to access authenticated private threads.</p>
        <AuthPanel />
      </section>
    );
  }

  return (
    <motion.section
      className="panel comms-layout"
      initial={false}
      animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: easingStandard }}
    >
      {showPageHeading ? (
        <div className="section-heading">
          <h1>Authenticated Comms</h1>
          <p>Private 1:1 threads to reach Quirin or his AI assistant, with an audit-backed exchange.</p>
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

      <div className="comms-grid" data-view={selectedThreadId ? "thread" : "list"}>
        <motion.aside className="comms-sidebar" layout={!reduceMotion}>
          <h2>
            <MessageCircle className="icon-sm" />
            Threads
          </h2>

          {secureTargets.length ? (
            <div className="secure-targets">
              <h3>Get in touch</h3>
              <p className="status-muted">
                Pick who you&apos;d like to reach. Threads are private and secured by your passkey.
              </p>
              <div className="secure-targets-grid">
                {secureTargets.map((target, index) => {
                  const Icon = target.kind === "ai" ? Bot : User;
                  return (
                    <motion.button
                      key={target.id}
                      type="button"
                      className="secure-target-button"
                      data-kind={target.kind}
                      data-coming-soon={target.comingSoon ? "" : undefined}
                      onClick={
                        target.comingSoon
                          ? undefined
                          : () => void onCreateSecureTargetThread(target)
                      }
                      disabled={isCreatingThread || target.comingSoon}
                      aria-label={
                        target.comingSoon
                          ? `${target.label} — coming soon`
                          : `Start secure chat with ${target.label}`
                      }
                      variants={cardReveal}
                      custom={index}
                      initial={false}
                      animate={reduceMotion ? undefined : "visible"}
                      whileHover={
                        reduceMotion || target.comingSoon ? undefined : { y: -2, transition: springSoft }
                      }
                    >
                      <Icon className="icon-sm" />
                      <strong>{target.comingSoon ? `${target.label} (coming soon)` : target.label}</strong>
                      <span>
                        {target.comingSoon ? "Coming soon — set up in progress." : target.description}
                      </span>
                    </motion.button>
                  );
                })}
              </div>
            </div>
          ) : null}

          <ul>
            {threads.length > 0 ? (
              threads.map((thread, index) => (
                <motion.li
                  key={thread.id}
                  initial={false}
                  animate={reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
                  transition={{ duration: 0.22, delay: index * 0.02 }}
                >
                  <button
                    type="button"
                    className={thread.id === selectedThreadId ? "active" : ""}
                    onClick={() => setSelectedThreadId(thread.id)}
                  >
                    <strong>{participantName(thread, currentUserId)}</strong>
                    <span className="comms-status-badge" data-status={thread.status}>
                      {friendlyStatus(thread.status)}
                    </span>
                  </button>
                </motion.li>
              ))
            ) : (
              <li>
                <p className="status-muted">
                  {hasActionableTarget
                    ? "No conversations yet. Use a button above to start one."
                    : ownerIsViewer
                      ? "No conversations yet. Threads that people start with you will show up here."
                      : "No conversations yet. Use ‘Reach someone else by email’ below to start one."}
                </p>
              </li>
            )}
          </ul>

          <details className="comms-email-disclosure">
            <summary>Reach someone else by email</summary>
            <form className="inline-form" onSubmit={onCreateThread}>
              <label>
                Their email address
                <input
                  type="email"
                  required
                  value={newThreadEmail}
                  onChange={(event) => setNewThreadEmail(event.target.value)}
                  placeholder="name@example.com"
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
          </details>
        </motion.aside>

        <motion.div className="comms-thread" layout={!reduceMotion}>
          <header>
            <button
              type="button"
              className="comms-back"
              onClick={() => setSelectedThreadId(null)}
              aria-label="Back to conversations"
            >
              <ChevronLeft className="icon-sm" />
              Back
            </button>
            <h2>{selectedThread ? participantName(selectedThread, currentUserId) : "Conversations"}</h2>
            {selectedThread ? (
              <span className="comms-status-badge" data-status={selectedThread.status}>
                {friendlyStatus(selectedThread.status)}
              </span>
            ) : (
              <p>Pick a conversation to read and reply.</p>
            )}
          </header>

          <div className="message-list" aria-live="polite">
            <AnimatePresence>
              {messages.length > 0 ? (
                messages.map((message) => {
                  const mine = message.senderUserId === currentUserId;
                  const otherName = selectedThread
                    ? participantName(selectedThread, currentUserId)
                    : "";
                  return (
                    <motion.article
                      key={message.id}
                      className={[
                        "message",
                        mine ? "mine" : "",
                        message.pending ? "pending" : "",
                        message.failed ? "failed" : "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                      initial={false}
                      animate={reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
                      transition={{ duration: 0.2 }}
                    >
                      <span>
                        {senderLabel(message, currentUserId, otherName)}
                        {message.pending ? " · sending…" : null}
                        {message.failed ? " · not sent" : null}
                      </span>
                      <p>{message.content}</p>
                      <time>{new Date(message.createdAt).toLocaleString("en-US")}</time>
                    </motion.article>
                  );
                })
              ) : (
                <motion.p
                  key="empty"
                  className="status-muted"
                  initial={false}
                  animate={{ opacity: 1 }}
                >
                  {selectedThreadId ? "No messages yet. Send the first message." : "Select a thread to view messages."}
                </motion.p>
              )}
            </AnimatePresence>
          </div>

          {selectedThreadId ? (
            <form className="message-form" onSubmit={onSendMessage}>
              <textarea
                required
                value={draftMessage}
                onChange={(event) => setDraftMessage(event.target.value)}
                placeholder="Write a message"
                disabled={isSendingMessage}
              />
              <button type="submit" disabled={isSendingMessage}>
                <Send className="icon-sm" />
                {isSendingMessage ? "Sending…" : "Send"}
              </button>
            </form>
          ) : null}
        </motion.div>
      </div>
    </motion.section>
  );
}
