# Secure Chat — Product Requirements Document

**Status:** Phase 1 in progress · Phases 2–3 specced · **Owner:** Quirin Schlegel ·
**Last updated:** 2026-05-31

---

## 1. Summary

Secure Chat is a private, passkey-secured channel on quirinschlegel.com where high-intent
visitors can reach Quirin directly about the projects he's working on — and, in later
phases, talk to Claude-powered bots that (a) answer questions grounded in his knowledge
vault and six-pagers, and (b) act as a conversational front-end for managing his projects
with invited collaborators.

The bar is **personal, trustworthy, and low-noise**: few but high-signal conversations,
not a public comment box.

## 2. Goals & non-goals

**Goals**
- Let a serious visitor (recruiter, collaborator, peer) start a private conversation with
  Quirin in a way that is spam-resistant and GDPR-clean.
- Guarantee the conversation round-trips: because no one gets in-app push notifications,
  every reply must produce an out-of-band nudge so neither side is left hanging.
- Give Quirin one fast place to triage and answer.
- Lay groundwork for one (and eventually several named) Claude-powered bots without
  over-building now: a vault-grounded concierge (Phase 2) and per-project management bots
  with invited collaborators (Phase 3).

**Non-goals (Phase 1)**
- Public/anonymous chat, real-time websockets/presence, voice, multi-language.
- An external relay microservice for the AI (the repo scaffold stays available but unused).
- Analytics dashboards, SLAs. (Collaborators and project management are explicitly in
  scope — but in Phase 3, not now.)

## 3. Principles

1. **Trust over reach.** Passkey + verified email is required for everyone. Deliberately
   high friction; it filters for intent and is spam-resistant. Consent + audit trail are
   already implemented (`EmailVerificationLink`, `AuditLog`).
2. **No dead-ends.** Neither party gets in-app push, so a reply must always trigger an
   email nudge to the *other* party. Quirin himself opts out of notifications (he checks
   the inbox on his own cadence); visitors get notified.
3. **The AI never pretends to be Quirin.** Bots are clearly labelled as assistants and
   hand off to him when unsure.
4. **Knowledge access, governed by a disclosure policy.** The concierge is *grounded* on
   the full knowledge vault and all six-pagers (including drafts/gated), but what it is
   allowed to *reveal* is controlled by a per-document visibility flag. The CV and anything
   flagged private are never surfaced — grounding ≠ disclosure.
5. **Project bots are a private cockpit, not a public feed.** Project management lives
   behind admin/collaborator auth by default; anything public is opt-in per project.

## 4. Personas

- **Visitor** — registers a passkey, associates and verifies a real email, then starts a
  thread. Returns via passkey to read replies; learns about new replies by email.
- **Quirin (owner / admin)** — triages and answers from `/admin/inbox`. Zero notification
  noise by choice. Identified via `ADMIN_EMAIL_ALLOWLIST`.
- **Concierge assistant(s)** (Phase 2) — one or more named bots (e.g. "Quirin's
  Assistant", later per-project bots) that greet, answer questions grounded in the vault
  and six-pagers (within the disclosure policy), and create/annotate a thread for Quirin.
- **Collaborator** (Phase 3) — a person Quirin invites into a specific project (passkey +
  email). Can talk to that project's bot and see/contribute to its tasks and updates; sees
  nothing outside the projects they're invited to.
- **Project bot(s)** (Phase 3) — per-project bots that capture tasks and status from
  conversation, surface what needs attention, optionally mirror GitHub activity, and (if a
  project opts in) answer public "what's the latest on X" questions.

## 5. Current state (already built)

- **Data model:** `Thread`, `ThreadParticipant`, `Message`, `BotIdentity`, `BotEvent`,
  `BotDeliveryAttempt`, `EmailVerificationLink` (`prisma/schema.prisma`).
- **Gating:** passkey (better-auth `passkey()` plugin) + email association with GDPR
  consent (`src/lib/passkey-email.ts`, `src/app/api/auth/associate-email/**`).
- **Visitor UI:** `src/components/CommsWorkspace.tsx` (Threads / Conversations) and
  `src/components/FloatingAuthChat.tsx` (auth + entry dock).
- **APIs:** `GET/POST /api/comms/threads`, `GET/POST /api/comms/threads/[id]/messages`
  with rate limits and content moderation (`src/lib/comms.ts`, `src/lib/moderation.ts`).
- **Admin inbox:** `src/app/admin/inbox/page.tsx` + `src/components/AdminInboxPanel.tsx`
  + `src/app/api/admin/inbox/threads/**`.
- **Email:** Resend wrapper (`src/lib/email/client.ts`) + react-email templates
  (`src/lib/email/templates.tsx`).
- **AI scaffold (inert):** `Thread.aiAutoReplyEnabled`, `BotEvent` relay to
  `BOT_RELAY_URL`. The "AI Assistant (coming soon)" tile is just an unset
  `NEXT_PUBLIC_SECURE_CHAT_QSBOT_EMAIL`.

## 6. Phase 1 — Human "reach me", made great (build now)

### 6.1 Visitor reply-notification email *(core new capability)*
**Why:** the "no dead-ends" principle. A visitor must learn that Quirin answered without
in-app push.

**Behavior:** when a message is created and addressed to a non-sender participant who
(a) has a real (non-bootstrap) email and (b) is **not** in the admin allowlist, send a
Resend email — *"Quirin replied — open Secure Chat"* — with a link back. The owner is
intentionally **not** emailed (his choice: in-app inbox only). Best-effort and
fire-and-forget; a send failure never blocks message creation.

**Implementation:** hook at the end of `createThreadMessage` in `src/lib/comms.ts` (after
the message row is created): resolve the other participants' `User.email`, filter out
bootstrap addresses and admins, send a new `SecureChatReplyEmail({ chatUrl })` template
via the existing `sendEmail` client. De-duplicate so a burst of replies doesn't spam (start
per-message; revisit with debounce if noisy).

### 6.2 Admin inbox polish
Verify and tighten the list → open thread → reply loop in `AdminInboxPanel`: show the
visitor's email + thread status, sort by most-recent activity, and make replying fast.
This is Quirin's primary surface.

### 6.3 Account pointer
A lightweight, admin-only "You have N open conversations → open inbox" pointer surfaced
from the account area, linking to `/admin/inbox`. (Discoverability already partly exists
via the account menu's "Admin · Inbox" link.)

### 6.4 Entry-point clarity
In `CommsWorkspace`, keep the Quirin tile primary and the AI tile an explicit "coming
soon", and set first-contact expectations: *"Quirin reads these personally; replies land
in your secure chat and we'll email you when he does."*

## 7. Phase 2 — Claude-powered concierge, grounded in the vault (later)

- **Backend:** in-process Claude — add `@anthropic-ai/sdk` + `ANTHROPIC_API_KEY` to
  `src/lib/env.ts`. Recommended over the `BOT_RELAY_URL` external relay for a personal
  site (fewer moving parts); the relay scaffold remains for future scale.
- **Seed** a `User` + `BotIdentity` for the concierge and set
  `NEXT_PUBLIC_SECURE_CHAT_QSBOT_EMAIL` so the UI tile activates.
- **Knowledge grounding (vault + six-pagers):** give the concierge retrieval over the full
  vault and six-pager corpus (the existing markdown/MDX content + `Subscriber`-gated
  six-pagers). Start simple — the corpus is small enough to **stuff relevant documents into
  context** (selected by slug/keyword) before reaching for embeddings/RAG. Each source
  document carries a **visibility flag** (`public` | `gated` | `private`); the system
  prompt is told it may *use* all grounded content to reason, but may only *quote or
  reveal* what the policy allows for the current audience. The CV is never part of the
  corpus. When it does surface a six-pager, it should link the canonical page rather than
  paste long excerpts.
- **Reply loop:** when a USER message lands in a thread with `aiAutoReplyEnabled` and an AI
  participant, assemble (persona + retrieved vault context + disclosure policy) and call
  Claude, then post a `BOT` message back. Guard against echo loops (skip when the sender is
  a bot). Reuse existing moderation + rate limits, and **moderate the bot's output too**,
  including a check that nothing `private`-flagged leaked.
- **Multi-assistant:** `BotIdentity` already supports many rows; the UI lists configured
  assistants. Launch with one general concierge; per-project bots come in Phase 3.
- **Safety:** tight system prompt, disclosure policy enforced on output, per-user rate
  limits, moderation on inbound and bot output, and a visible "AI assistant" label.

## 8. Phase 3 — Project management through bots (later, larger)

The bots become Quirin's conversational cockpit for running projects, with invited
collaborators. **The app database is the source of truth** (no dependency on an external
PM tool); GitHub is an optional mirror, not the system of record.

### 8.1 Capabilities (the "all of the above" the owner asked for)
- **Task & status capture** — talk to a project bot ("add a task: …", "what's blocking
  X?", "mark Y done") and it maintains tasks, notes, and a rolling project status.
- **GitHub mirror** — pull issues / PR / commit activity for a linked repo (reuse the
  existing GitHub timeline integration) into the project view so the bot can answer "what
  changed this week". Writes back to GitHub are optional and explicit.
- **Public updates (opt-in per project)** — a project can publish a status the project bot
  will share when a visitor asks "what's the latest on X" (ties into the "built in public"
  angle). Off by default.
- **Ops assistant** — on demand (and optionally on a schedule via the existing cron),
  summarize activity, surface what needs attention, and nudge Quirin.

### 8.2 Audience & access
- **Owner** drives everything. **Collaborators** are invited per project (reusing the
  passkey + email-association flow) and see only the projects they're invited to. A simple
  role per membership (`OWNER` | `COLLABORATOR`) gates who can change vs. view.

### 8.3 Data model (new Prisma models, DB-canonical)
- `Project` (name, slug, status, visibility, linked GitHub repo, ownerUserId).
- `ProjectMember` (projectId, userId, role) — the invite/permission join.
- `Task` (projectId, title, state, assigneeUserId?, dueAt?, createdFrom: chat|github|manual).
- `ProjectUpdate` (projectId, body, visibility, authorUserId|botId) — the status feed.
- Optionally `ProjectThread` linking a `Thread` to a `Project` so a bot conversation is
  scoped to one project. Bot actions are recorded in the existing `AuditLog`.

### 8.4 Bot tool-use
The project bot is the concierge backend plus a small set of **tools** (function-calling):
`create_task`, `update_task`, `list_tasks`, `post_update`, `get_github_activity`. Each tool
is a thin server action over the models above, authorized by the caller's `ProjectMember`
role. This keeps the bot's power explicit, auditable, and permission-checked — the LLM
proposes, the server authorizes.

## 9. Success metrics

- A visitor who sends a first message receives a reply and *sees* it (open-rate of the
  reply email; conversations that get a visitor response after Quirin replies).
- Quirin's time-to-first-reply trends down once the inbox is the single triage surface.
- Near-zero spam/abuse reaching the inbox (passkey + email gating holds).

## 10. Risks & mitigations

- **Quirin forgets to check (no self-notifications).** Accepted for low volume; revisit
  with an optional digest if traffic grows. The account pointer (6.3) is the nudge.
- **Reply-email noise.** Start per-message; add debounce/grouping if it becomes chatty.
- **Vault disclosure leak (Phase 2).** The bot is grounded on *all* vault content, so the
  disclosure policy is the safety boundary, not the grounding. Mitigate with a per-document
  `visibility` flag, an output check that nothing `private` leaked, the CV excluded from
  the corpus entirely, and a conservative default (link the page, don't paste).
- **Bot taking unauthorized PM actions (Phase 3).** The LLM only *proposes*; every tool
  call is authorized server-side against the caller's `ProjectMember` role and written to
  `AuditLog`. No destructive tool without confirmation.
- **GitHub write-back surprises (Phase 3).** Default read-only mirror; writes are explicit
  and opt-in per project.
- **Deliverability.** Emails send from the Resend-verified `scr-x.com` domain with
  reply-to routing to `PUBLIC_EMAIL`.

## 11. Open questions

- Concierge persona/voice and how documents are selected into context (slug/keyword vs.
  embeddings) — Quirin authors the persona in Phase 2; start with keyword selection.
- Exactly which six-pagers are `public` vs `gated` vs `private` (the visibility flags).
- Whether the reply email should be per-message or debounced (default per-message).
- Phase 3: collaborator invite UX (reuse associate-email, or a lighter project-invite
  link?), and whether public project updates need their own page or just live in chat.
- Phase 3: which GitHub write-backs (if any) are worth the risk vs. read-only mirror.
