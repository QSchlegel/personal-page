import type { ThreadMessage, ThreadSummary } from "@/lib/types";

/** Whether a secure-chat target is a human (the owner) or an AI assistant. */
export type SecureTargetKind = "person" | "ai";

/** Map a raw thread status enum to a human-readable label. */
export function friendlyStatus(status: ThreadSummary["status"]): string {
  switch (status) {
    case "OPEN":
      return "Open";
    case "RESOLVED":
      return "Resolved";
    case "ARCHIVED":
      return "Archived";
    default:
      return status;
  }
}

/**
 * Friendly display name for the other side of a 1:1 thread. Falls back to the
 * email, then "AI Assistant" for bot-only threads (no distinct human
 * participant), and finally a neutral "Conversation".
 */
export function participantName(thread: ThreadSummary, currentUserId: string): string {
  const other = thread.participants.find((participant) => participant.id !== currentUserId);
  if (other) {
    return other.name || other.email || "Conversation";
  }
  return "AI Assistant";
}

/**
 * Friendly label for a message's sender, shown in the bubble badge.
 * `otherName` is the already-resolved name of the other participant.
 */
export function senderLabel(
  message: ThreadMessage,
  currentUserId: string,
  otherName: string,
): string {
  if (message.senderType === "SYSTEM") {
    return "System";
  }
  if (message.senderType === "BOT") {
    return "AI Assistant";
  }
  if (message.senderUserId === currentUserId) {
    return "You";
  }
  return otherName || "Them";
}
