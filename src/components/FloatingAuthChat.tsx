"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Fingerprint, LoaderCircle, Minimize2 } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

import { CommsWorkspace } from "@/components/CommsWorkspace";
import { authClient } from "@/lib/auth-client";
import { hasLocalPasskeySupport, hasPasskeySupport } from "@/lib/passkey";

const CHAT_AUTH_PARAM = "chatAuth";
const CHAT_AUTH_INTENT = "passkey";
const PASSKEY_REGISTERED_CODE = "ERROR_AUTHENTICATOR_PREVIOUSLY_REGISTERED";
const PASSKEY_REGISTERED_MESSAGE = "previously registered";

interface AuthError {
  code?: string;
  message?: string;
}

function toErrorMessage(error: AuthError | null | undefined, fallback: string) {
  return error?.message?.trim() || fallback;
}

export function FloatingAuthChat() {
  const { data: session, isPending } = authClient.useSession();
  const [status, setStatus] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [hasCallbackIntent, setHasCallbackIntent] = useState(false);
  const callbackIntentHandled = useRef(false);
  const reduceMotion = useReducedMotion();

  const isSignedIn = Boolean(session?.user?.id);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const params = new URLSearchParams(window.location.search);
    setHasCallbackIntent(params.get(CHAT_AUTH_PARAM) === CHAT_AUTH_INTENT);
  }, []);

  const clearCallbackIntent = useCallback(() => {
    if (typeof window === "undefined") {
      return;
    }

    const url = new URL(window.location.href);
    if (!url.searchParams.has(CHAT_AUTH_PARAM)) {
      return;
    }

    url.searchParams.delete(CHAT_AUTH_PARAM);
    const query = url.searchParams.toString();
    const next = `${url.pathname}${query ? `?${query}` : ""}${url.hash}`;
    window.history.replaceState({}, "", next);
    setHasCallbackIntent(false);
  }, []);

  const registerPasskey = useCallback(async (preferLocal: boolean) => {
    const result = await authClient.passkey.addPasskey({
      name: "Portfolio Passkey",
      ...(preferLocal ? { authenticatorAttachment: "platform" as const } : {}),
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
    if (isBusy || isPending) {
      return;
    }

    setStatus(null);

    if (!hasPasskeySupport()) {
      setStatus("Passkeys are not supported on this browser/device.");
      return;
    }

    setIsBusy(true);

    try {
      const hasLocalPasskeyAuthenticator = await hasLocalPasskeySupport();

      if (hasLocalPasskeyAuthenticator) {
        const passkeySignIn = await authClient.signIn.passkey();

        if (!passkeySignIn.error) {
          setIsChatOpen(true);
          setStatus("Secure chat unlocked.");
          return;
        }
      }

      if (isSignedIn) {
        const registration = await registerPasskey(hasLocalPasskeyAuthenticator);
        if (registration.ok) {
          setIsChatOpen(true);
          setStatus("Passkey registered. Secure chat unlocked.");
        } else {
          setStatus(registration.message ?? "Passkey registration failed.");
        }
        return;
      }

      setStatus("Redirecting to GitHub to register your passkey...");
      await authClient.signIn.social({
        provider: "github",
        callbackURL: "/?chatAuth=passkey",
      });
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Secure access failed.");
    } finally {
      setIsBusy(false);
    }
  }, [isBusy, isPending, isSignedIn, registerPasskey]);

  useEffect(() => {
    if (!hasCallbackIntent) {
      callbackIntentHandled.current = false;
      return;
    }

    if (!isSignedIn || callbackIntentHandled.current) {
      return;
    }

    callbackIntentHandled.current = true;
    setStatus("Finishing passkey setup...");
    setIsBusy(true);

    void (async () => {
      if (!hasPasskeySupport()) {
        setStatus("Passkeys are not supported on this browser/device.");
        clearCallbackIntent();
        setIsBusy(false);
        return;
      }

      const hasLocalPasskeyAuthenticator = await hasLocalPasskeySupport();
      const registration = await registerPasskey(hasLocalPasskeyAuthenticator);

      if (registration.ok) {
        setIsChatOpen(true);
        setStatus("Secure chat unlocked.");
      } else {
        setStatus(registration.message ?? "Passkey setup could not be completed.");
      }

      clearCallbackIntent();
      setIsBusy(false);
    })();
  }, [clearCallbackIntent, hasCallbackIntent, isSignedIn, registerPasskey]);

  return (
    <>
      <motion.div
        className="floating-chat-dock"
        initial={false}
        animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
        transition={{ duration: 0.34 }}
      >
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
