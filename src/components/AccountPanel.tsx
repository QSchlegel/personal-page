"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Check,
  Inbox,
  KeyRound,
  LogOut,
  Mail,
  Megaphone,
  MonitorSmartphone,
  Trash2,
  UserCircle2,
} from "lucide-react";

import { authClient } from "@/lib/auth-client";
import { registerPasskeyOnThisDevice } from "@/lib/passkey";

type SubscriptionStatus = "PENDING" | "CONFIRMED" | "UNSUBSCRIBED";

export interface AccountInitial {
  user: {
    email: string;
    name: string;
    memberSince: string;
    emailVerified: boolean;
  };
  profile: {
    displayName: string;
  };
  subscription:
    | {
        status: SubscriptionStatus;
        confirmedAt: string | null;
        unsubscribedAt: string | null;
        since: string;
      }
    | null;
  isAdmin: boolean;
}

interface AccountPanelProps {
  initial: AccountInitial;
}

interface PasskeyRow {
  id: string;
  name?: string | null;
  deviceType?: string | null;
  backedUp?: boolean;
  createdAt?: string;
}

interface SessionRow {
  id: string;
  token: string;
  ipAddress?: string | null;
  userAgent?: string | null;
  createdAt: string | Date;
  expiresAt: string | Date;
  current?: boolean;
}

type Status = { kind: "ok" | "err"; message: string } | null;

function fmtDate(value?: string | Date | null): string {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return typeof value === "string" ? value : "—";
  }
}

function maskIp(ip?: string | null): string {
  if (!ip) return "—";
  // best-effort masking: keep the network portion, hide the rest
  if (ip.includes(".")) {
    const parts = ip.split(".");
    if (parts.length === 4) return `${parts[0]}.${parts[1]}.•.•`;
  }
  if (ip.includes(":")) {
    const parts = ip.split(":");
    return `${parts.slice(0, 2).join(":")}:••`;
  }
  return ip;
}

function summariseUserAgent(ua?: string | null): string {
  if (!ua) return "Unknown browser";
  if (/iPhone|iPad/i.test(ua)) return "iOS · Safari";
  if (/Android/i.test(ua)) return /Chrome/i.test(ua) ? "Android · Chrome" : "Android";
  if (/Mac OS X/i.test(ua)) return /Safari/i.test(ua) && !/Chrome/i.test(ua) ? "macOS · Safari" : "macOS · Chrome";
  if (/Windows/i.test(ua)) return /Edg/.test(ua) ? "Windows · Edge" : "Windows · Chrome";
  if (/Linux/i.test(ua)) return "Linux · Browser";
  return "Unknown browser";
}

function describeSubscription(initial: AccountInitial["subscription"]): string {
  if (!initial) return "Not subscribed";
  switch (initial.status) {
    case "CONFIRMED":
      return `Subscribed since ${fmtDate(initial.confirmedAt ?? initial.since)}`;
    case "PENDING":
      return "Pending — confirmation email sent";
    case "UNSUBSCRIBED":
      return `Unsubscribed on ${fmtDate(initial.unsubscribedAt)}`;
    default:
      return "Not subscribed";
  }
}

export function AccountPanel({ initial }: AccountPanelProps) {
  const router = useRouter();

  return (
    <div className="account-page">
      <header className="account-page-head">
        <p className="eyebrow">Account</p>
        <h1>Settings</h1>
        <p>Manage your identity, passkeys, sessions, newsletter and (when you must) erasure.</p>
      </header>

      <IdentityPanel initial={initial} />
      <PasskeysPanel />
      <SessionsPanel />
      <NewsletterPanel initial={initial.subscription} userEmail={initial.user.email} />
      <DangerZone email={initial.user.email} onDeleted={() => router.push("/")} />
    </div>
  );
}

// -- Identity ----------------------------------------------------------------

function IdentityPanel({ initial }: { initial: AccountInitial }) {
  const [displayName, setDisplayName] = useState(initial.profile.displayName);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<Status>(null);
  const dirty = displayName.trim() !== initial.profile.displayName.trim();

  async function onSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setStatus(null);
    try {
      const response = await fetch("/api/account/profile", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ displayName: displayName.trim() }),
      });
      const data = (await response.json().catch(() => ({}))) as { error?: { message?: string } };
      if (!response.ok) {
        setStatus({ kind: "err", message: data.error?.message ?? "Couldn't save." });
        return;
      }
      setStatus({ kind: "ok", message: "Saved." });
    } catch {
      setStatus({ kind: "err", message: "Network error." });
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="panel account-panel">
      <header>
        <h2>
          <UserCircle2 className="icon-sm" /> Identity
        </h2>
        <p className="status-muted">How we know you — what shows up in chat and emails.</p>
      </header>

      <dl className="account-rows">
        <div>
          <dt>Email</dt>
          <dd>{initial.user.email}</dd>
        </div>
        <div>
          <dt>Member since</dt>
          <dd>{fmtDate(initial.user.memberSince)}</dd>
        </div>
        {initial.isAdmin ? (
          <div>
            <dt>Role</dt>
            <dd>Administrator</dd>
          </div>
        ) : null}
      </dl>

      <form className="account-form" onSubmit={onSave}>
        <label>
          Display name
          <input
            type="text"
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            maxLength={80}
            required
          />
        </label>
        <div className="account-form-actions">
          <button type="submit" disabled={!dirty || saving}>
            {saving ? "Saving…" : "Save"}
          </button>
          {status ? (
            <p className={`form-status ${status.kind}`} role="status">
              {status.kind === "ok" ? <Check className="icon-sm" /> : null}
              {status.message}
            </p>
          ) : null}
        </div>
      </form>
    </section>
  );
}

// -- Passkeys (filled out in J3) --------------------------------------------

function PasskeysPanel() {
  const [passkeys, setPasskeys] = useState<PasskeyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [registering, setRegistering] = useState(false);
  const [status, setStatus] = useState<Status>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const response = await authClient.$fetch<PasskeyRow[]>("/passkey/list-user-passkeys", {
        method: "GET",
        throw: false,
      });
      if (response?.data && Array.isArray(response.data)) {
        setPasskeys(response.data);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  // Mount-time load. Kept inline (rather than calling `reload()` directly)
  // so the react-hooks/set-state-in-effect rule doesn't flag the
  // indirection through a useCallback.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const response = await authClient.$fetch<PasskeyRow[]>("/passkey/list-user-passkeys", {
          method: "GET",
          throw: false,
        });
        if (!cancelled && response?.data && Array.isArray(response.data)) {
          setPasskeys(response.data);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function onRegister() {
    if (registering) return;
    setRegistering(true);
    setStatus(null);
    try {
      const result = await registerPasskeyOnThisDevice("Portfolio Passkey");
      if (result.error) {
        setStatus({ kind: "err", message: result.error.message ?? "Couldn't register." });
        return;
      }
      setStatus({ kind: "ok", message: "Passkey added." });
      await reload();
    } catch (error) {
      setStatus({
        kind: "err",
        message: error instanceof Error ? error.message : "Registration failed.",
      });
    } finally {
      setRegistering(false);
    }
  }

  async function onRemove(id: string) {
    if (busyId) return;
    if (passkeys.length <= 1) {
      setStatus({
        kind: "err",
        message: "This is your last passkey. Add another one first so you don't lock yourself out.",
      });
      return;
    }
    setBusyId(id);
    setStatus(null);
    try {
      const response = await authClient.$fetch<{ ok?: boolean }>("/passkey/delete-passkey", {
        method: "POST",
        body: { id },
        throw: false,
      });
      const err = response?.error as { message?: string } | undefined;
      if (err) {
        setStatus({ kind: "err", message: err.message ?? "Couldn't remove the passkey." });
        return;
      }
      setStatus({ kind: "ok", message: "Passkey removed." });
      await reload();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section className="panel account-panel">
      <header>
        <h2>
          <KeyRound className="icon-sm" /> Passkeys
        </h2>
        <p className="status-muted">
          Devices that can sign you in. Add a second one so a lost device doesn&apos;t lock you out.
        </p>
      </header>

      <ul className="account-list">
        {loading ? (
          <li className="status-muted">Loading…</li>
        ) : passkeys.length === 0 ? (
          <li className="status-muted">No passkeys yet.</li>
        ) : (
          passkeys.map((pk) => (
            <li key={pk.id}>
              <div className="account-list-main">
                <strong>{pk.name ?? "Portfolio Passkey"}</strong>
                <span>
                  {pk.deviceType ?? "device"}
                  {pk.backedUp ? " · synced" : ""}
                  {pk.createdAt ? ` · added ${fmtDate(pk.createdAt)}` : ""}
                </span>
              </div>
              <button
                type="button"
                className="account-list-danger"
                onClick={() => void onRemove(pk.id)}
                disabled={busyId === pk.id}
              >
                <Trash2 className="icon-sm" />
                {busyId === pk.id ? "Removing…" : "Remove"}
              </button>
            </li>
          ))
        )}
      </ul>

      <div className="account-form-actions">
        <button type="button" onClick={() => void onRegister()} disabled={registering}>
          <KeyRound className="icon-sm" />
          {registering ? "Adding…" : "Add another passkey"}
        </button>
        {status ? (
          <p className={`form-status ${status.kind}`} role="status">
            {status.message}
          </p>
        ) : null}
      </div>
    </section>
  );
}

// -- Sessions ----------------------------------------------------------------

function SessionsPanel() {
  const { data: current } = authClient.useSession();
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyToken, setBusyToken] = useState<string | null>(null);
  const [revokingOthers, setRevokingOthers] = useState(false);
  const [status, setStatus] = useState<Status>(null);

  const currentSessionToken = current?.session?.token ?? null;

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const response = await authClient.listSessions();
      if (response?.data && Array.isArray(response.data)) {
        const rows: SessionRow[] = response.data.map((session) => ({
          ...session,
          current: session.token === currentSessionToken,
        }));
        setSessions(rows);
      }
    } finally {
      setLoading(false);
    }
  }, [currentSessionToken]);

  // Initial load — kept inline so the react-hooks/set-state-in-effect rule
  // doesn't flag the indirection through `reload`.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const response = await authClient.listSessions();
        if (cancelled) return;
        if (response?.data && Array.isArray(response.data)) {
          const rows: SessionRow[] = response.data.map((session) => ({
            ...session,
            current: session.token === currentSessionToken,
          }));
          setSessions(rows);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [currentSessionToken]);

  async function onRevoke(token: string) {
    if (busyToken) return;
    if (token === currentSessionToken) return;
    setBusyToken(token);
    setStatus(null);
    try {
      const response = await authClient.revokeSession({ token });
      if (response?.error) {
        setStatus({ kind: "err", message: response.error.message ?? "Couldn't revoke." });
        return;
      }
      setStatus({ kind: "ok", message: "Session revoked." });
      await reload();
    } finally {
      setBusyToken(null);
    }
  }

  async function onRevokeOthers() {
    if (revokingOthers) return;
    setRevokingOthers(true);
    setStatus(null);
    try {
      const response = await authClient.revokeOtherSessions();
      if (response?.error) {
        setStatus({ kind: "err", message: response.error.message ?? "Couldn't sign out other sessions." });
        return;
      }
      setStatus({ kind: "ok", message: "Signed out everywhere else." });
      await reload();
    } finally {
      setRevokingOthers(false);
    }
  }

  return (
    <section className="panel account-panel">
      <header>
        <h2>
          <MonitorSmartphone className="icon-sm" /> Sessions
        </h2>
        <p className="status-muted">Where you&apos;re currently signed in. Revoke anything you don&apos;t recognise.</p>
      </header>

      <ul className="account-list">
        {loading ? (
          <li className="status-muted">Loading…</li>
        ) : sessions.length === 0 ? (
          <li className="status-muted">No sessions found.</li>
        ) : (
          sessions.map((s) => (
            <li key={s.id}>
              <div className="account-list-main">
                <strong>
                  {summariseUserAgent(s.userAgent)}
                  {s.current ? <span className="badge"> · this device</span> : null}
                </strong>
                <span>
                  IP {maskIp(s.ipAddress)} · started {fmtDate(s.createdAt)} · expires {fmtDate(s.expiresAt)}
                </span>
              </div>
              <button
                type="button"
                className="account-list-danger"
                onClick={() => void onRevoke(s.token)}
                disabled={Boolean(s.current) || busyToken === s.token}
              >
                <LogOut className="icon-sm" />
                {s.current ? "Current" : busyToken === s.token ? "Revoking…" : "Revoke"}
              </button>
            </li>
          ))
        )}
      </ul>

      <div className="account-form-actions">
        <button
          type="button"
          onClick={() => void onRevokeOthers()}
          disabled={revokingOthers || sessions.length <= 1}
        >
          <LogOut className="icon-sm" />
          {revokingOthers ? "Signing out…" : "Sign out everywhere else"}
        </button>
        {status ? (
          <p className={`form-status ${status.kind}`} role="status">
            {status.message}
          </p>
        ) : null}
      </div>
    </section>
  );
}

// -- Newsletter --------------------------------------------------------------

function NewsletterPanel({
  initial,
  userEmail,
}: {
  initial: AccountInitial["subscription"];
  userEmail: string;
}) {
  const [state, setState] = useState(initial);
  const [consent, setConsent] = useState(false);
  const [working, setWorking] = useState(false);
  const [status, setStatus] = useState<Status>(null);

  const summary = useMemo(() => describeSubscription(state), [state]);
  const isConfirmed = state?.status === "CONFIRMED";
  const isPending = state?.status === "PENDING";

  async function onSubscribe() {
    if (working) return;
    if (!consent) {
      setStatus({ kind: "err", message: "Please tick the consent box first." });
      return;
    }
    setWorking(true);
    setStatus(null);
    try {
      const response = await fetch("/api/account/newsletter/subscribe", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ consent: true }),
      });
      const data = (await response.json().catch(() => ({}))) as {
        ok?: boolean;
        alreadyConfirmed?: boolean;
        error?: { message?: string };
      };
      if (!response.ok) {
        setStatus({ kind: "err", message: data.error?.message ?? "Could not subscribe." });
        return;
      }
      if (data.alreadyConfirmed) {
        setState((prev) =>
          prev
            ? { ...prev, status: "CONFIRMED", confirmedAt: prev.confirmedAt ?? new Date().toISOString() }
            : { status: "CONFIRMED", confirmedAt: new Date().toISOString(), unsubscribedAt: null, since: new Date().toISOString() },
        );
        setStatus({ kind: "ok", message: "You were already confirmed — kept you on the list." });
      } else {
        setState((prev) =>
          prev
            ? { ...prev, status: "PENDING" }
            : { status: "PENDING", confirmedAt: null, unsubscribedAt: null, since: new Date().toISOString() },
        );
        setStatus({ kind: "ok", message: "Confirmation email sent. Check your inbox." });
      }
      setConsent(false);
    } catch {
      setStatus({ kind: "err", message: "Network error." });
    } finally {
      setWorking(false);
    }
  }

  async function onUnsubscribe() {
    if (working) return;
    setWorking(true);
    setStatus(null);
    try {
      const response = await fetch("/api/account/newsletter/unsubscribe", {
        method: "POST",
      });
      const data = (await response.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: { message?: string };
      };
      if (!response.ok) {
        setStatus({ kind: "err", message: data.error?.message ?? "Could not unsubscribe." });
        return;
      }
      setState((prev) =>
        prev
          ? { ...prev, status: "UNSUBSCRIBED", unsubscribedAt: new Date().toISOString() }
          : { status: "UNSUBSCRIBED", confirmedAt: null, unsubscribedAt: new Date().toISOString(), since: new Date().toISOString() },
      );
      setStatus({ kind: "ok", message: "Unsubscribed." });
    } catch {
      setStatus({ kind: "err", message: "Network error." });
    } finally {
      setWorking(false);
    }
  }

  return (
    <section className="panel account-panel">
      <header>
        <h2>
          <Megaphone className="icon-sm" /> Newsletter
        </h2>
        <p className="status-muted">One short email when a new six-pager lands. Linked to {userEmail}.</p>
      </header>

      <p className="account-status">
        <Mail className="icon-sm" /> {summary}
      </p>

      {!isConfirmed && !isPending ? (
        <div className="account-form">
          <label className="associate-consent">
            <input
              type="checkbox"
              checked={consent}
              onChange={(event) => setConsent(event.target.checked)}
              disabled={working}
            />
            <span>
              I agree to receive occasional emails about new six-pagers and understand I can
              unsubscribe at any time.
            </span>
          </label>
          <div className="account-form-actions">
            <button type="button" onClick={() => void onSubscribe()} disabled={working || !consent}>
              {working ? "Subscribing…" : "Subscribe"}
            </button>
            {status ? (
              <p className={`form-status ${status.kind}`} role="status">
                {status.message}
              </p>
            ) : null}
          </div>
        </div>
      ) : (
        <div className="account-form-actions">
          <button
            type="button"
            className="account-list-danger"
            onClick={() => void onUnsubscribe()}
            disabled={working}
          >
            {working ? "Unsubscribing…" : "Unsubscribe"}
          </button>
          {status ? (
            <p className={`form-status ${status.kind}`} role="status">
              {status.message}
            </p>
          ) : null}
        </div>
      )}
    </section>
  );
}

// -- Danger zone -------------------------------------------------------------

function DangerZone({ email, onDeleted }: { email: string; onDeleted: () => void }) {
  const [open, setOpen] = useState(false);
  const [confirmEmail, setConfirmEmail] = useState("");
  const [working, setWorking] = useState(false);
  const [status, setStatus] = useState<Status>(null);

  const enabled = confirmEmail.trim().toLowerCase() === email.toLowerCase();

  async function onDelete() {
    if (working || !enabled) return;
    setWorking(true);
    setStatus(null);
    try {
      const response = await fetch("/api/account/delete", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: confirmEmail.trim().toLowerCase() }),
      });
      const data = (await response.json().catch(() => ({}))) as { error?: { message?: string } };
      if (!response.ok) {
        setStatus({ kind: "err", message: data.error?.message ?? "Could not delete account." });
        return;
      }
      await authClient.signOut().catch(() => undefined);
      onDeleted();
    } catch {
      setStatus({ kind: "err", message: "Network error." });
    } finally {
      setWorking(false);
    }
  }

  return (
    <section className="panel account-panel account-danger">
      <header>
        <h2>
          <AlertTriangle className="icon-sm" /> Danger zone
        </h2>
        <p className="status-muted">
          Permanently delete your account, passkeys, chat threads and any newsletter subscription
          tied to this email. This action is irreversible — DSGVO Art. 17, right to erasure.
        </p>
      </header>

      {!open ? (
        <div className="account-form-actions">
          <button type="button" className="account-list-danger" onClick={() => setOpen(true)}>
            <Trash2 className="icon-sm" /> Delete account
          </button>
        </div>
      ) : (
        <div className="account-form">
          <p>
            Type your email <code>{email}</code> below to confirm.
          </p>
          <label>
            Confirm email
            <input
              type="email"
              value={confirmEmail}
              onChange={(event) => setConfirmEmail(event.target.value)}
              autoComplete="off"
              spellCheck={false}
              placeholder={email}
            />
          </label>
          <div className="account-form-actions">
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setConfirmEmail("");
                setStatus(null);
              }}
              disabled={working}
            >
              Cancel
            </button>
            <button
              type="button"
              className="account-list-danger"
              onClick={() => void onDelete()}
              disabled={!enabled || working}
            >
              <Trash2 className="icon-sm" />
              {working ? "Deleting…" : "Delete account"}
            </button>
          </div>
          {status ? (
            <p className={`form-status ${status.kind}`} role="status">
              {status.message}
            </p>
          ) : null}
          <p className="status-muted">
            Need a copy of your data first? <a href={`mailto:${email}`}>Email us</a> before deleting and we&apos;ll
            send what we hold. <span className="inline-icon"><Inbox className="icon-sm" /></span>
          </p>
        </div>
      )}
    </section>
  );
}
