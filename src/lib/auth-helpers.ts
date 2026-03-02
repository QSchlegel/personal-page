import { headers } from "next/headers";

import { auth } from "@/lib/auth";
import { getAdminAllowlist } from "@/lib/env";
import { jsonError } from "@/lib/http";

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  image?: string | null;
}

export interface SessionContext {
  user: SessionUser;
  session: {
    id: string;
    userId: string;
    expiresAt: Date;
  };
}

export async function getServerSession(): Promise<SessionContext | null> {
  const requestHeaders = await headers();
  const session = await auth.api.getSession({ headers: requestHeaders });
  return (session as SessionContext | null) ?? null;
}

export async function getRequestSession(request: Request): Promise<SessionContext | null> {
  const session = await auth.api.getSession({ headers: request.headers });
  return (session as SessionContext | null) ?? null;
}

export function isAdminEmail(email?: string | null): boolean {
  if (!email) {
    return false;
  }

  return getAdminAllowlist().has(email.toLowerCase());
}

export async function requireUser(request: Request): Promise<
  | { ok: true; session: SessionContext }
  | { ok: false; response: ReturnType<typeof jsonError> }
> {
  const session = await getRequestSession(request);

  if (!session?.user?.id) {
    return {
      ok: false,
      response: jsonError("UNAUTHORIZED", "Authentication required.", 401),
    };
  }

  return {
    ok: true,
    session,
  };
}

export async function requireAdmin(request: Request): Promise<
  | { ok: true; session: SessionContext }
  | { ok: false; response: ReturnType<typeof jsonError> }
> {
  const result = await requireUser(request);
  if (!result.ok) {
    return result;
  }

  if (!isAdminEmail(result.session.user.email)) {
    return {
      ok: false,
      response: jsonError("FORBIDDEN", "Admin access required.", 403),
    };
  }

  return result;
}
