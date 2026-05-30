"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { Fingerprint, KeyRound, LoaderCircle, Mail, Minimize2, X } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

import { CommsWorkspace } from "@/components/CommsWorkspace";
import { authClient } from "@/lib/auth-client";
import { isBootstrapEmail } from "@/lib/identity";
import {
  ensureSessionForPasskey,
  hasLocalPasskeySupport,
  hasPasskeySupport,
  registerPasskeyOnThisDevice,
  signInPasskeyOnThisDevice,
} from "@/lib/passkey";

const PASSKEY_REGISTERED_CODE = "ERROR_AUTHENTICATOR_PREVIOUSLY_REGISTERED";
const PASSKEY_REGISTERED_MESSAGE = "previously registered";

interface AuthError {
  code?: string;
  message?: string;
}

function toErrorMessage(error: AuthError | null | undefined, fallback: string) {
  return error?.message?.trim() || fallback;
}

type Step = "idle" | "choose" | "busy" | "associate-email";

export function FloatingAuthChat() {
  const { data: session, isPending } = authClient.useSession();
  const [status, setStatus] = useState<string | null>(null);
  const [step, setStep] = useState<Step>("idle");
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [resetKey, setResetKey] = useState(0);
  const [associateEmail, setAssociateEmail] = useState("");
  const [associateConsent, setAssociateConsent] = useState(false);
  const [associateNewsletter, setAssociateNewsletter] = useState(false);
  const [isAssociating, setIsAssociating] = useState(false);
  const reduceMotion = useReducedMotion();

  const isSignedIn = Boolean(session?.user?.id);
  const isBootstrap = isBootstrapEmail(session?.user?.email);
  const isBusy = step === "busy";

  const registerPasskey = useCallback(async () => {
    const result = await registerPasskeyOnThisDevice("Portfolio Passkey");

    if (!result.error) {
      return { ok: true as const };
    }

    const code = (result.error as AuthError).code;
    const message = (result.error as AuthError).message ?? "";
    const alreadyRegistered =
      code === PASSKEY_REGISTERED_CODE ||
      message.toLowerCase().includes(PASSKEY_REGISTERED_MESSAGE);

    if (alreadyRegistered) {
      return { ok: true as const };
    }

    return {
      ok: false as const,
      message: toErrorMessage(result.error as AuthError, "Passkey registration failed."),
    };
  }, []);

  const openChat = useCallback((message: string | null = null) => {
    setIsChatOpen(true);
    setStatus(message);
    setStep("idle");
  }, []);

  /** Reset CommsWorkspace's internal state on every modal close. */
  const closeChat = useCallback(() => {
    setIsChatOpen(false);
    setResetKey((value) => value + 1);
  }, []);

  /** Either open the chat (associated) or prompt for email association first. */
  const advanceAfterAuth = useCallback(
    (message: string | null = null) => {
      if (isBootstrap) {
        setStep("associate-email");
        setStatus(message);
      } else {
        openChat(message);
      }
    },
    [isBootstrap, openChat],
  );

  const onSignInPasskey = useCallback(async () => {
    setStep("busy");
    setStatus(null);
    try {
      const result = await signInPasskeyOnThisDevice();
      if (!result.error) {
        // useSession will pick up the new session shortly; let advanceAfterAuth
        // pivot once the email surfaces. Re-running an effect is overkill —
        // the next render with fresh `isBootstrap` will branch correctly.
        openChat();
        return;
      }
      setStatus(toErrorMessage(result.error, "Couldn't sign in with that passkey. Register one to continue."));
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Passkey sign-in failed.");
    }
    setStep("choose");
  }, [openChat]);

  const onRegisterPasskey = useCallback(async () => {
    setStep("busy");
    setStatus(null);

    try {
      const hasLocal = await hasLocalPasskeySupport();
      if (!hasLocal) {
        setStatus("This device has no built-in passkey (Face ID, Touch ID, or Windows Hello). Try a device that supports it.");
        setStep("choose");
        return;
      }

      // Ensure a session exists (creates a lightweight account if needed).
      if (!isSignedIn) {
        setStatus("Setting up secure access…");
        const session = await ensureSessionForPasskey();
        if (!session.ok) {
          setStatus(session.error ?? "Could not set up secure access.");
          setStep("choose");
          return;
        }
      }

      const registration = await registerPasskey();
      if (registration.ok) {
        // New bootstrap user → ask for their real email. Existing users with
        // a passkey re-registration just open the chat.
        advanceAfterAuth("Passkey registered.");
      } else {
        setStatus(registration.message ?? "Passkey registration failed.");
        setStep("choose");
      }
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Registration failed.");
      setStep("choose");
    }
  }, [isSignedIn, registerPasskey, advanceAfterAuth]);

  const onLaunchSecureChat = useCallback(async () => {
    if (step !== "idle" || isPending) {
      return;
    }

    setStatus(null);

    if (!hasPasskeySupport()) {
      setStatus("Passkeys aren't supported on this browser. Try a recent Safari, Chrome, or Edge.");
      return;
    }

    if (isSignedIn) {
      // If the user came back with only the bootstrap email, prompt for
      // association before opening chat.
      if (isBootstrap) {
        setStep("associate-email");
      } else {
        setIsChatOpen(true);
      }
      return;
    }

    const hasLocal = await hasLocalPasskeySupport();
    if (!hasLocal) {
      setStatus("This device has no built-in passkey (Face ID, Touch ID, or Windows Hello).");
      setStep("choose");
      return;
    }

    // Don't auto-attempt discoverable sign-in: it triggers the browser's full
    // WebAuthn picker (QR / security key / phone) even when the user just wants
    // to register a new on-device passkey. Show the explicit Register / Sign In
    // choice instead — users who do have a synced passkey can still pick Sign
    // In themselves.
    setStep("choose");
  }, [step, isPending, isSignedIn, isBootstrap]);

  const onCancel = useCallback(() => {
    setStep("idle");
    setStatus(null);
  }, []);

  const onAssociateEmail = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (isAssociating) return;
      setStatus(null);

      const email = associateEmail.trim().toLowerCase();
      if (!email || !associateConsent) {
        setStatus("Please enter your email and agree to the data-processing notice.");
        return;
      }

      setIsAssociating(true);
      try {
        const response = await fetch("/api/auth/associate-email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email,
            consent: true,
            newsletterOptIn: associateNewsletter,
          }),
        });
        const data = (await response.json().catch(() => ({}))) as {
          ok?: boolean;
          newsletterOptInSent?: boolean;
          error?: AuthError;
        };
        if (!response.ok) {
          setStatus(data.error?.message ?? "Could not associate that email.");
          return;
        }

        // Force the session cache to refetch so the new email is visible
        // before we hand off to CommsWorkspace (which reads currentUserEmail
        // for the secure-targets filter).
        authClient.$store.notify("$sessionSignal");

        const tail = data.newsletterOptInSent
          ? " Check your inbox to confirm the newsletter."
          : "";
        openChat(`Email associated.${tail}`);
        setAssociateEmail("");
        setAssociateConsent(false);
        setAssociateNewsletter(false);
      } catch (error) {
        setStatus(error instanceof Error ? error.message : "Network error.");
      } finally {
        setIsAssociating(false);
      }
    },
    [associateEmail, associateConsent, associateNewsletter, isAssociating, openChat],
  );

  // If the modal is open but the session has reverted to a bootstrap state
  // (e.g. server returned EMAIL_NOT_ASSOCIATED), bounce back to the
  // associate-email step.
  const handleEmailNotAssociated = useCallback(() => {
    setIsChatOpen(false);
    setStep("associate-email");
    setStatus("Please associate a real email to continue.");
  }, []);

  // Pre-fill the associate form with a newsletter address if one was used —
  // there's no transport for that today, so just default to empty. Left as a
  // placeholder for future "we already know this email" prefill.
  useEffect(() => {
    if (step !== "associate-email") return;
    // no-op; reserved for future prefill
  }, [step]);

  return (
    <>
      <motion.div
        className="floating-chat-dock"
        initial={false}
        animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
        transition={{ duration: 0.34 }}
      >
        {step === "choose" ? (
          <div className="floating-chat-choices">
            <button type="button" className="floating-chat-trigger" onClick={onRegisterPasskey}>
              <KeyRound className="icon-sm" />
              Register Passkey
            </button>
            <button type="button" className="floating-chat-trigger" onClick={onSignInPasskey}>
              <Fingerprint className="icon-sm" />
              Sign In
            </button>
            <button
              type="button"
              className="floating-chat-trigger floating-chat-ghost"
              onClick={onCancel}
              aria-label="Cancel passkey setup"
            >
              <X className="icon-sm" />
            </button>
          </div>
        ) : step === "associate-email" ? null : (
          <button
            type="button"
            className="floating-chat-trigger"
            onClick={onLaunchSecureChat}
            disabled={isBusy || isPending}
            aria-haspopup="dialog"
            aria-expanded={isChatOpen}
          >
            {isBusy ? <LoaderCircle className="icon-sm icon-spin" /> : <Fingerprint className="icon-sm" />}
            {isBusy ? "Securing..." : "Secure Chat"}
          </button>
        )}

        <AnimatePresence>
          {status && step !== "associate-email" ? (
            <motion.p
              className="floating-chat-status"
              initial={false}
              animate={reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
              exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 6 }}
            >
              {status}
            </motion.p>
          ) : null}
        </AnimatePresence>
      </motion.div>

      {/* ------------ Email association overlay ------------ */}
      <AnimatePresence>
        {step === "associate-email" ? (
          <motion.div
            className="floating-chat-overlay"
            role="presentation"
            initial={false}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="floating-chat-modal floating-chat-associate"
              role="dialog"
              aria-modal="true"
              aria-label="Associate an email with your passkey"
              initial={false}
              animate={reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
              exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 14, scale: 0.98 }}
              transition={{ duration: 0.25 }}
            >
              <header className="associate-head">
                <h2>
                  <Mail className="icon-sm" />
                  Associate your email
                </h2>
                <p>
                  Your passkey is registered. Now tell us which email represents you so other
                  people can reach you in secure chat. If the address is already on the
                  newsletter list, we&apos;ll link it silently — otherwise we&apos;ll ask you to
                  confirm.
                </p>
              </header>

              <form className="associate-form" onSubmit={onAssociateEmail}>
                <label>
                  Email
                  <input
                    type="email"
                    autoComplete="email"
                    required
                    value={associateEmail}
                    onChange={(event) => setAssociateEmail(event.target.value)}
                    placeholder="you@example.com"
                    disabled={isAssociating}
                  />
                </label>
                <label className="associate-consent">
                  <input
                    type="checkbox"
                    required
                    checked={associateConsent}
                    onChange={(event) => setAssociateConsent(event.target.checked)}
                    disabled={isAssociating}
                  />
                  <span>
                    I agree my email may be stored and processed to enable secure chat. See the{" "}
                    <a href="/privacy" target="_blank" rel="noreferrer">
                      privacy policy
                    </a>
                    .
                  </span>
                </label>
                <label className="associate-consent">
                  <input
                    type="checkbox"
                    checked={associateNewsletter}
                    onChange={(event) => setAssociateNewsletter(event.target.checked)}
                    disabled={isAssociating}
                  />
                  <span>Also send me an email when a new six-pager is published (optional, double opt-in).</span>
                </label>

                {status ? <p className="status-error">{status}</p> : null}

                <div className="associate-actions">
                  <button
                    type="button"
                    className="floating-chat-trigger floating-chat-ghost"
                    onClick={onCancel}
                    disabled={isAssociating}
                  >
                    Not now
                  </button>
                  <button
                    type="submit"
                    className="floating-chat-trigger"
                    disabled={isAssociating || !associateConsent || !associateEmail.trim()}
                  >
                    {isAssociating ? <LoaderCircle className="icon-sm icon-spin" /> : <Mail className="icon-sm" />}
                    {isAssociating ? "Associating…" : "Continue"}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      {/* ------------ Chat modal ------------ */}
      <AnimatePresence>
        {isChatOpen ? (
          <motion.div
            className="floating-chat-overlay"
            role="presentation"
            initial={false}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={(event) => {
              if (event.target === event.currentTarget) {
                closeChat();
              }
            }}
          >
            <motion.div
              className="floating-chat-modal"
              role="dialog"
              aria-modal="true"
              aria-label="Authenticated chat"
              initial={false}
              animate={reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
              exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 14, scale: 0.98 }}
              transition={{ duration: 0.25 }}
            >
              <button type="button" className="floating-chat-collapse" onClick={closeChat}>
                <Minimize2 className="icon-sm" />
                Collapse
              </button>
              <CommsWorkspace
                key={resetKey}
                embedded
                showPageHeading={false}
                onEmailNotAssociated={handleEmailNotAssociated}
              />
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  );
}
