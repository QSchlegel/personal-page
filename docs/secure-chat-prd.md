# Secure Chat — Product Requirements Document

**Status:** Phase 1 in progress · **Owner:** Quirin Schlegel · **Last updated:** 2026-05-31

---

## 1. Summary

Secure Chat is a private, passkey-secured channel on quirinschlegel.com where high-intent
visitors can reach Quirin directly about the projects he's working on — and, in a later
phase, talk to a Claude-powered concierge that answers questions about his public projects
and hands off to him.

The bar is **personal, trustworthy, and low-noise**: few but high-signal conversations,
not a public comment box.

## 2. Goals & non-goals

**Goals**
- Let a serious visitor (recruiter, collaborator, peer) start a private conversation with
  Quirin in a way that is spam-resistant and GDPR-clean.
- Guarantee the conversation round-trips: because no one gets in-app push notifications,
  every reply must produce an out-of-band nudge so neither side is left hanging.
- Give Quirin one fast place to triage and answer.
- Lay groundwork for one (and eventually several named) Claude-powered concierge
  assistants without over-building now.

**Non-goals (now)**
- Public/anonymous chat, real-time websockets/presence, voice, multi-language.
- An external relay microservice for the AI (the repo scaffold stays available but unused).
- Analytics dashboards, SLAs, team/multi-agent human support.

## 3. Principles

1. **Trust over reach.** Passkey + verified email is required for everyone. Deliberately
   high friction; it filters for intent and is spam-resistant. Consent + audit trail are
   already implemented (`EmailVerificationLink`, `AuditLog`).
2. **No dead-ends.** Neither party gets in-app push, so a reply must always trigger an
   email nudge to the *other* party. Quirin himself opts out of notifications (he checks
   the inbox on his own cadence); visitors get notified.
3. **The AI never pretends to be Quirin.** Concierge-scoped, public information only. CV
   and knowledge-vault private content stay private. The assistant hands off when unsure.

## 4. Personas

- **Visitor** — registers a passkey, associates and verifies a real email, then starts a
  thread. Returns via passkey to read replies; learns about new replies by email.
- **Quirin (owner / admin)** — triages and answers from `/admin/inbox`. Zero notification
  noise by choice. Identified via `ADMIN_EMAIL_ALLOWLIST`.
- **Concierge assistant(s)** (Phase 2) — one or more named bots (e.g. "Quirin's
  Assistant", later per-project bots) that greet, answer public-project questions within
  tight guardrails, and create/annotate a thread for Quirin.

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

## 7. Phase 2 — Claude-powered concierge (later, separate effort)

- **Backend:** in-process Claude — add `@anthropic-ai/sdk` + `ANTHROPIC_API_KEY` to
  `src/lib/env.ts`. Recommended over the `BOT_RELAY_URL` external relay for a personal
  site (fewer moving parts); the relay scaffold remains for future scale.
- **Seed** a `User` + `BotIdentity` for the concierge and set
  `NEXT_PUBLIC_SECURE_CHAT_QSBOT_EMAIL` so the UI tile activates.
- **Reply loop:** when a USER message lands in a thread with `aiAutoReplyEnabled` and an AI
  participant, call Claude with a concierge system prompt (persona + curated public-project
  context; explicit "never reveal private/CV info, never impersonate Quirin, hand off when
  unsure"), then post a `BOT` message back. Guard against echo loops (skip when the sender
  is a bot). Reuse existing moderation + rate limits, and moderate the bot's output too.
- **Multi-assistant:** `BotIdentity` already supports many rows; the UI lists configured
  assistants. Launch with one; adding another is a seed + config change.
- **Safety:** tight system prompt, public info only, per-user rate limits, moderation on
  inbound and bot output, and a visible "AI assistant" label on bot messages.

## 8. Success metrics

- A visitor who sends a first message receives a reply and *sees* it (open-rate of the
  reply email; conversations that get a visitor response after Quirin replies).
- Quirin's time-to-first-reply trends down once the inbox is the single triage surface.
- Near-zero spam/abuse reaching the inbox (passkey + email gating holds).

## 9. Risks & mitigations

- **Quirin forgets to check (no self-notifications).** Accepted for low volume; revisit
  with an optional digest if traffic grows. The account pointer (6.3) is the nudge.
- **Reply-email noise.** Start per-message; add debounce/grouping if it becomes chatty.
- **AI hallucination / privacy leak (Phase 2).** Concierge-only scope, public context,
  output moderation, explicit non-impersonation, hand-off on uncertainty.
- **Deliverability.** Emails send from the Resend-verified `scr-x.com` domain with
  reply-to routing to `PUBLIC_EMAIL`.

## 10. Open questions

- Concierge persona/voice and the curated public-project context document (Quirin authors
  in Phase 2).
- Whether the reply email should be per-message or debounced (default per-message).
- Whether per-project assistants are worth the UI surface, or one concierge suffices.
