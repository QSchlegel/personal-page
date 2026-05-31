"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";

/**
 * Route-level error boundary for /account. A server-side throw in the page
 * loader would otherwise render the bare Next.js error screen ("A server error
 * occurred"); this gives the user a calm, recoverable surface instead.
 */
export default function AccountError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Account page error:", error);
  }, [error]);

  return (
    <div className="account-page">
      <header className="account-page-head">
        <p className="eyebrow">Account</p>
        <h1>Something went wrong</h1>
        <p>We couldn’t load your account just now.</p>
      </header>

      <section className="panel account-panel">
        <div className="account-list-main">
          <AlertTriangle className="icon-sm" aria-hidden="true" />
          <p>
            This is usually temporary. Try again in a moment — if it keeps
            happening, head back to the homepage and reopen your account.
          </p>
        </div>
        <div className="account-form-actions">
          <button type="button" onClick={() => reset()}>
            Try again
          </button>
          <Link href="/">Back to homepage</Link>
        </div>
      </section>
    </div>
  );
}
