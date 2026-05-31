import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Email verification — Quirin Schlegel",
  robots: { index: false },
};

type Status = "associated" | "claimed" | "invalid" | "expired" | "taken";

const COPY: Record<Status, { eyebrow: string; title: string; subtitle: string; body: React.ReactNode }> = {
  associated: {
    eyebrow: "Secure chat",
    title: "Email confirmed ✓",
    subtitle: "Your address is linked to your passkey.",
    body: (
      <>
        You can close this tab and head back to the site — open <strong>Secure Chat</strong> and you&apos;re ready to
        message.
      </>
    ),
  },
  claimed: {
    eyebrow: "Secure chat",
    title: "Passkey attached ✓",
    subtitle: "Your new passkey is now linked to your existing account.",
    body: (
      <>
        Head back to the site, open <strong>Secure Chat</strong>, and choose <strong>Sign In</strong> to use your new
        passkey — it now signs you into your existing account.
      </>
    ),
  },
  expired: {
    eyebrow: "Secure chat",
    title: "This link has expired",
    subtitle: "Verification links are valid for 30 minutes.",
    body: <>Open Secure Chat again and re-enter your email to get a fresh link.</>,
  },
  taken: {
    eyebrow: "Secure chat",
    title: "That email is now in use",
    subtitle: "Another account claimed this address before you confirmed.",
    body: (
      <>
        Open Secure Chat, enter the email again, and choose <strong>attach this passkey</strong> to sign in with your
        new passkey instead.
      </>
    ),
  },
  invalid: {
    eyebrow: "Secure chat",
    title: "This link is no longer valid",
    subtitle: "It may have already been used, or it doesn’t exist.",
    body: <>Open Secure Chat again and re-enter your email to get a fresh link.</>,
  },
};

export default async function SecureChatVerifiedPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  const key: Status = (["associated", "claimed", "invalid", "expired", "taken"] as const).includes(
    status as Status,
  )
    ? (status as Status)
    : "invalid";
  const copy = COPY[key];

  return (
    <article>
      <header className="article-head">
        <p className="eyebrow">{copy.eyebrow}</p>
        <h1>{copy.title}</h1>
        <p className="subtitle">{copy.subtitle}</p>
      </header>
      <p>{copy.body}</p>
      <p>
        Back to <Link href="/">the homepage</Link>.
      </p>
    </article>
  );
}
