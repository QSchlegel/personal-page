"use client";

import { useCallback, useState } from "react";
import { Fingerprint, KeyRound, LoaderCircle, Minimize2, X } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

import { CommsWorkspace } from "@/components/CommsWorkspace";
import { authClient } from "@/lib/auth-client";
import {
  ensureSessionForPasskey,
  hasLocalPasskeySupport,
  hasPasskeySupport,
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

type Step = "idle" | "choose" | "busy";

export function FloatingAuthChat() {
  const { data: session, isPending } = authClient.useSession();
  const [status, setStatus] = useState<string | null>(null);
  const [step, setStep] = useState<Step>("idle");
  const [isChatOpen, setIsChatOpen] = useState(false);
  const reduceMotion = useReducedMotion();

  const isSignedIn = Boolean(session?.user?.id);
  const isBusy = step === "busy";

  const registerPasskey = useCallback(async () => {
    const result = await authClient.passkey.addPasskey({
      name: "Portfolio Passkey",
      authenticatorAttachment: "platform" as const,
    });

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

  const onSignInPasskey = useCallback(async () => {
    setStep("busy");
    setStatus(null);
    try {
      const result = await signInPasskeyOnThisDevice();
      if (!result.error) {
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
        openChat("Passkey registered. Secure chat unlocked.");
      } else {
        setStatus(registration.message ?? "Passkey registration failed.");
        setStep("choose");
      }
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Registration failed.");
      setStep("choose");
    }
  }, [isSignedIn, registerPasskey, openChat]);

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
      setIsChatOpen(true);
      return;
    }

    const hasLocal = await hasLocalPasskeySupport();
    if (!hasLocal) {
      setStatus("This device has no built-in passkey (Face ID, Touch ID, or Windows Hello).");
      setStep("choose");
      return;
    }

    // Always attempt a discoverable passkey sign-in first so returning users —
    // including those with a synced passkey on a new browser, cleared storage,
    // or private mode — recover their existing chat instead of being pushed into
    // a fresh account. On failure, onSignInPasskey falls through to the
    // register/sign-in choice.
    await onSignInPasskey();
  }, [step, isPending, isSignedIn, onSignInPasskey]);

  const onCancel = useCallback(() => {
    setStep("idle");
    setStatus(null);
  }, []);

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
        ) : (
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
          {status ? (
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
                setIsChatOpen(false);
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
              <button type="button" className="floating-chat-collapse" onClick={() => setIsChatOpen(false)}>
                <Minimize2 className="icon-sm" />
                Collapse
              </button>
              <CommsWorkspace embedded showPageHeading={false} />
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  );
}
