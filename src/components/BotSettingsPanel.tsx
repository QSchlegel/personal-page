"use client";

import { FormEvent, useEffect, useState } from "react";
import { Clock3, KeyRound, Plus, Trash2 } from "lucide-react";

import { AuthPanel } from "@/components/AuthPanel";
import { authClient } from "@/lib/auth-client";
import type { BotKeyMetadata } from "@/lib/types";

interface KeysResponse {
  keys: BotKeyMetadata[];
}

export function BotSettingsPanel() {
  const { data: session, isPending } = authClient.useSession();
  const [keys, setKeys] = useState<BotKeyMetadata[]>([]);
  const [name, setName] = useState("Default Bot Key");
  const [latestSecret, setLatestSecret] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const signedIn = Boolean(session?.user?.id);

  async function loadKeys() {
    const response = await fetch("/api/bot/keys");
    if (!response.ok) {
      throw new Error(`Unable to load keys (${response.status})`);
    }

    const payload = (await response.json()) as KeysResponse;
    setKeys(payload.keys);
  }

  useEffect(() => {
    if (!signedIn) return;

    let cancelled = false;

    (async () => {
      try {
        const response = await fetch("/api/bot/keys");
        if (!response.ok) {
          throw new Error(`Unable to load keys (${response.status})`);
        }

        const payload = (await response.json()) as KeysResponse;
        if (cancelled) return;
        setKeys(payload.keys);
      } catch (error) {
        if (cancelled) return;
        setStatus(error instanceof Error ? error.message : "Unable to load keys.");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [signedIn]);

  async function createKey(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus(null);

    const response = await fetch("/api/bot/keys", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });

    if (!response.ok) {
      const payload = (await response.json()) as { error?: { message?: string } };
      setStatus(payload.error?.message ?? "Unable to create key.");
      return;
    }

    const payload = (await response.json()) as { secret: string };
    setLatestSecret(payload.secret);
    await loadKeys();
  }

  async function revokeKey(keyId: string) {
    setStatus(null);

    const response = await fetch(`/api/bot/keys/${keyId}`, {
      method: "DELETE",
    });

    if (!response.ok) {
      const payload = (await response.json()) as { error?: { message?: string } };
      setStatus(payload.error?.message ?? "Unable to revoke key.");
      return;
    }

    await loadKeys();
  }

  if (isPending) {
    return <p className="status-muted">Checking session...</p>;
  }

  if (!signedIn) {
    return (
      <section className="panel">
        <h1>Bot Settings</h1>
        <p className="status-muted">Sign in to manage bot credentials.</p>
        <AuthPanel />
      </section>
    );
  }

  return (
    <section className="panel">
      <div className="section-heading">
        <h1>Bot Settings</h1>
        <p>Create and revoke API keys for one bot identity per user.</p>
      </div>

      {status ? <p className="status-error">{status}</p> : null}

      <form className="inline-form" onSubmit={createKey}>
        <label>
          Key Name
          <input value={name} onChange={(event) => setName(event.target.value)} minLength={2} maxLength={64} />
        </label>
        <button type="submit">
          <Plus className="icon-sm" />
          Create Key
        </button>
      </form>

      {latestSecret ? (
        <div className="secret-callout">
          <strong>New key secret (shown once)</strong>
          <code>{latestSecret}</code>
        </div>
      ) : null}

      <div className="admin-list">
        {keys.map((key) => (
          <article key={key.id} className="admin-item">
            <header>
              <h2>{key.name}</h2>
              <span>{key.revokedAt ? "Revoked" : "Active"}</span>
            </header>

            <p className="meta-line">
              <KeyRound className="icon-sm" />
              <code>{key.keyId}</code>
            </p>
            <p>Created: {new Date(key.createdAt).toLocaleString("en-US")}</p>
            <p className="meta-line">
              <Clock3 className="icon-sm" />
              Last used: {key.lastUsedAt ? new Date(key.lastUsedAt).toLocaleString("en-US") : "Never"}
            </p>

            {!key.revokedAt ? (
              <button type="button" onClick={() => revokeKey(key.keyId)}>
                <Trash2 className="icon-sm" />
                Revoke Key
              </button>
            ) : null}
          </article>
        ))}
      </div>
    </section>
  );
}
