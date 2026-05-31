"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ChevronDown,
  Inbox,
  LogOut,
  Megaphone,
  Settings,
  UserCircle2,
} from "lucide-react";

import { authClient } from "@/lib/auth-client";
import { isBootstrapEmail } from "@/lib/identity";

interface MeResponse {
  isAdmin: boolean;
  isBootstrap: boolean;
}

/**
 * Identity pill rendered next to "Secure Chat" in the floating dock.
 *
 * Hidden when there's no session or when the user is still on the synthetic
 * `passkey-*@local.invalid` address (the associate-email step needs to
 * happen first; surfacing an account menu there would be confusing).
 */
export function AccountMenu() {
  const { data: session, isPending } = authClient.useSession();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [meta, setMeta] = useState<MeResponse | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const userId = session?.user?.id;
  const email = session?.user?.email;
  const name = session?.user?.name;
  const isBootstrap = isBootstrapEmail(email);

  // Hydrate admin/newsletter metadata once we have a session and email isn't
  // bootstrap (avoid an unnecessary 401 dance during the associate flow).
  // Stale `meta` is safe — the component returns null before reading it
  // when `userId` is missing, so we don't reset state here.
  useEffect(() => {
    if (!userId || isBootstrap) {
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch("/api/account/me");
        if (!response.ok) return;
        const data = (await response.json()) as MeResponse;
        if (!cancelled) setMeta(data);
      } catch {
        // best-effort; UI degrades to "non-admin" gracefully
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, isBootstrap]);

  // Close on outside-click, ESC.
  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const onSignOut = useCallback(async () => {
    if (signingOut) return;
    setSigningOut(true);
    try {
      await authClient.signOut();
      setOpen(false);
      router.refresh();
    } finally {
      setSigningOut(false);
    }
  }, [signingOut, router]);

  if (isPending || !userId || isBootstrap) {
    return null;
  }

  const display = email ?? name ?? "Account";
  const initial = (name?.[0] ?? email?.[0] ?? "?").toUpperCase();
  const isAdmin = meta?.isAdmin === true;

  return (
    <div className="account-pill-wrap" ref={containerRef}>
      <button
        ref={buttonRef}
        type="button"
        className="account-pill"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Account menu for ${display}`}
      >
        <span className="account-pill-avatar" aria-hidden="true">
          {initial}
        </span>
        <span className="account-pill-email">{display}</span>
        <ChevronDown className="icon-sm account-pill-chevron" aria-hidden="true" />
      </button>

      {open ? (
        <div className="account-menu" role="menu" aria-label="Account">
          <div className="account-menu-head">
            <UserCircle2 className="icon-sm" aria-hidden="true" />
            <span className="account-menu-email">{display}</span>
          </div>
          <Link
            href="/account"
            className="account-menu-item"
            role="menuitem"
            onClick={() => setOpen(false)}
          >
            <Settings className="icon-sm" aria-hidden="true" />
            Account settings
          </Link>
          {isAdmin ? (
            <>
              <Link
                href="/admin/inbox"
                className="account-menu-item"
                role="menuitem"
                onClick={() => setOpen(false)}
              >
                <Inbox className="icon-sm" aria-hidden="true" />
                Admin · Inbox
              </Link>
              <Link
                href="/admin/newsletter"
                className="account-menu-item"
                role="menuitem"
                onClick={() => setOpen(false)}
              >
                <Megaphone className="icon-sm" aria-hidden="true" />
                Admin · Newsletter
              </Link>
            </>
          ) : null}
          <button
            type="button"
            className="account-menu-item account-menu-item-danger"
            role="menuitem"
            onClick={() => void onSignOut()}
            disabled={signingOut}
          >
            <LogOut className="icon-sm" aria-hidden="true" />
            {signingOut ? "Signing out…" : "Sign out"}
          </button>
        </div>
      ) : null}
    </div>
  );
}
