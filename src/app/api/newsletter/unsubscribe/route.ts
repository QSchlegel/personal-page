import { NextResponse } from "next/server";

import { jsonError, jsonOk } from "@/lib/http";
import { unsubscribeByToken } from "@/lib/newsletter";
import { absoluteUrl } from "@/lib/site";

// Human clicks the link in an email → unsubscribe and show a friendly page.
export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token");
  if (token) {
    await unsubscribeByToken(token);
  }
  // Public origin, not request.url (internal 0.0.0.0:8080 behind the proxy).
  return NextResponse.redirect(absoluteUrl("/newsletter/unsubscribed"));
}

// RFC 8058 one-click unsubscribe (List-Unsubscribe-Post) — mail clients POST here.
export async function POST(request: Request) {
  const token = new URL(request.url).searchParams.get("token");
  if (!token) {
    return jsonError("BAD_REQUEST", "Missing token.", 400);
  }
  const ok = await unsubscribeByToken(token);
  return ok ? jsonOk({ ok: true }) : jsonError("NOT_FOUND", "Unknown token.", 404);
}
