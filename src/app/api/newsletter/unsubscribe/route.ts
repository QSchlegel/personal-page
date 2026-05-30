import { NextResponse } from "next/server";

import { jsonError, jsonOk } from "@/lib/http";
import { unsubscribeByToken } from "@/lib/newsletter";

// Human clicks the link in an email → unsubscribe and show a friendly page.
export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token");
  if (token) {
    await unsubscribeByToken(token);
  }
  return NextResponse.redirect(new URL("/newsletter/unsubscribed", request.url));
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
