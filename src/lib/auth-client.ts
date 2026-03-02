"use client";

import { passkeyClient } from "@better-auth/passkey/client";
import { createAuthClient } from "better-auth/react";

function resolveAuthBaseUrl(): string {
  if (typeof window !== "undefined") {
    return `${window.location.origin}/api/auth`;
  }

  const origin =
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.BETTER_AUTH_URL ??
    "http://localhost:3000";

  return `${origin.replace(/\/$/, "")}/api/auth`;
}

export const authClient = createAuthClient({
  baseURL: resolveAuthBaseUrl(),
  plugins: [passkeyClient()],
});
