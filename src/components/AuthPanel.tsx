"use client";

import { useState } from "react";
import { Github, KeyRound, LogOut, ShieldCheck } from "lucide-react";

import { authClient } from "@/lib/auth-client";

export function AuthPanel({ className = "" }: { className?: string }) {
  const { data: session, isPending } = authClient.useSession();
  const [message, setMessage] = useState<string | null>(null);

  const isSignedIn = Boolean(session?.user?.id);

  async function signInGithub() {
    setMessage(null);
    await authClient.signIn.social({
      provider: "github",
      callbackURL: "/comms",
    });
  }

  async function signInPasskey() {
    setMessage(null);
    const result = await authClient.signIn.passkey();
    if (result.error) {
      setMessage(result.error.message ?? "Passkey sign-in failed.");
    }
  }

  async function addPasskey() {
    setMessage(null);
    const result = await authClient.passkey.addPasskey({
      name: "Portfolio Passkey",
    });

    if (result.error) {
      setMessage(result.error.message ?? "Passkey registration failed.");
      return;
    }

    setMessage("Passkey registered.");
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
          <>
            <button type="button" onClick={signInGithub} disabled={isPending}>
              <Github className="icon-sm" />
              Continue with GitHub
            </button>
            <button type="button" onClick={signInPasskey} disabled={isPending}>
              <KeyRound className="icon-sm" />
              Sign in with Passkey
            </button>
          </>
        ) : (
          <>
            <button type="button" onClick={addPasskey}>
              <ShieldCheck className="icon-sm" />
              Register Passkey
            </button>
            <button type="button" onClick={signOut}>
              <LogOut className="icon-sm" />
              Sign out
            </button>
          </>
        )}
      </div>

      {message ? <p className="auth-message">{message}</p> : null}
    </div>
  );
}
