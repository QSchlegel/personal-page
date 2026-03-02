export interface TimelineProject {
  repoName: string;
  fullName: string;
  description: string | null;
  language: string | null;
  homepage: string | null;
  htmlUrl: string;
  createdAt: string;
  updatedAt: string;
  pushedAt: string | null;
  stars: number;
  label: string | null;
  summary: string | null;
  iframeUrl: string | null;
  isFeatured: boolean;
  featuredOrder: number | null;
}

export interface TimelineOverride {
  repoName: string;
  isFeatured: boolean;
  featuredOrder: number | null;
  label: string | null;
  summary: string | null;
  iframeUrl: string | null;
  hide: boolean;
}

export interface TimelineResponse {
  curated: TimelineProject[];
  all: TimelineProject[];
  fetchedAt: string;
  source: "database" | "github-live" | "seed-fallback";
}

export interface ThreadSummary {
  id: string;
  status: "OPEN" | "RESOLVED" | "ARCHIVED";
  aiAutoReplyEnabled: boolean;
  updatedAt: string;
  participants: Array<{
    id: string;
    email: string;
    name: string;
    image: string | null;
  }>;
  lastMessage: ThreadMessage | null;
}

export interface ThreadMessage {
  id: string;
  threadId: string;
  senderType: "USER" | "BOT" | "SYSTEM";
  senderUserId: string | null;
  senderBotId: string | null;
  content: string;
  createdAt: string;
  moderated: boolean;
}

export interface BotEvent {
  id: string;
  recipientUserId: string;
  threadId: string;
  messageId: string;
  status: "PENDING" | "DELIVERED" | "FAILED" | "ACKNOWLEDGED";
  attempts: number;
  payload: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface BotKeyMetadata {
  id: string;
  keyId: string;
  name: string;
  lastUsedAt: string | null;
  createdAt: string;
  revokedAt: string | null;
}

export interface RelayDeliveryResult {
  eventId: string;
  success: boolean;
  statusCode?: number;
  error?: string;
  deliveredAt: string;
}

export interface ApiError {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}
