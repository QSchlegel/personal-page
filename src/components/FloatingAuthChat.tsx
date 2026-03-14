"use client";

import { useCallback, useState } from "react";
import { Fingerprint, KeyRound, LoaderCircle, Minimize2 } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

import { CommsWorkspace } from "@/components/CommsWorkspace";
import { authClient } from "@/lib/auth-client";
import { hasLocalPasskeySupport, hasPasskeySupport } from "@/lib/passkey";

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

  const onLaunchSecureChat = useCallback(async () => {
    if (step !== "idle" || isPending) {
      return;
    }

    setStatus(null);

    if (!hasPasskeySupport()) {
      setStatus("Passkeys are not supported on this browser/device.");
      return;
    }

    const hasLocal = await hasLocalPasskeySupport();

    if (!hasLocal) {
      setStatus("No local passkey authenticator found.");
      setStep("choose");
      return;
    }

    if (isSignedIn) {
      setIsChatOpen(true);
      return;
    }

    setStep("busy");

    try {
      const passkeySignIn = await authClient.signIn.passkey();

      if (!passkeySignIn.error) {
        setIsChatOpen(true);
        setStatus("Secure chat unlocked.");
        setStep("idle");
        return;
      }
    } catch {
      // local passkey sign-in failed, fall through to registration
    }

    setStatus("No local passkey found. Register one to continue.");
    setStep("choose");
  }, [step, isPending, isSignedIn]);

  const onRegisterPasskey = useCallback(async () => {
    setStep("busy");
    setStatus(null);

    try {
      const hasLocal = await hasLocalPasskeySupport();

      if (!hasLocal) {
        setStatus("No on-device authenticator available. Use a device with biometric or PIN support.");
        return;
      }

      const registration = await registerPasskey();
      if (registration.ok) {
        setIsChatOpen(true);
        setStatus("Passkey registered. Secure chat unlocked.");
      } else {
        setStatus(registration.message ?? "Passkey registration failed.");
      }
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Registration failed.");
    } finally {
      setStep("idle");
    }
  }, [registerPasskey]);

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
              Register New Passkey
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
