"use client";

import { useState } from "react";
import { KeyRound, LogOut } from "lucide-react";

import { authClient } from "@/lib/auth-client";
import { hasLocalPasskeySupport, hasPasskeySupport } from "@/lib/passkey";

export function AuthPanel({ className = "" }: { className?: string }) {
  const { data: session, isPending } = authClient.useSession();
  const [message, setMessage] = useState<string | null>(null);

  const isSignedIn = Boolean(session?.user?.id);

  async function signInPasskey() {
    setMessage(null);

    if (!hasPasskeySupport()) {
      setMessage("Passkeys are not supported on this browser/device.");
      return;
    }

    const hasLocalPasskeyAuthenticator = await hasLocalPasskeySupport();

    if (!hasLocalPasskeyAuthenticator) {
      setMessage("No local passkey authenticator is available. Sign in with GitHub, then register a passkey.");
      return;
    }

    const result = await authClient.signIn.passkey();
    if (result.error) {
      setMessage(result.error.message ?? "Passkey sign-in failed.");
    }
  }

  async function signOut() {
    setMessage(null);
    await authClient.signOut();
  }

  return (
    <div className={`auth-panel ${className}`}>
      <div className="auth-header">
        <strong>{isSignedIn ? "Signed in" : "Secure Access"}</strong>
        <span>{isSignedIn ? session?.user.email : "GitHub + Passkey"}</span>
      </div>

      <div className="auth-actions">
        {!isSignedIn ? (
          <button type="button" onClick={signInPasskey} disabled={isPending}>
            <KeyRound className="icon-sm" />
            Sign in with Passkey
          </button>
        ) : (
          <button type="button" onClick={signOut}>
            <LogOut className="icon-sm" />
            Sign out
          </button>
        )}
      </div>

      {message ? <p className="auth-message">{message}</p> : null}
    </div>
  );
}
