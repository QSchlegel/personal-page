import { NextResponse } from "next/server";

import { confirmEmailVerificationLink } from "@/lib/passkey-email";
import { absoluteUrl } from "@/lib/site";

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token");
  const status = token ? await confirmEmailVerificationLink(token) : "invalid";
  // Build the redirect from the public site origin, not request.url — behind
  // the proxy the latter is the internal bind address (0.0.0.0:8080), which
  // isn't reachable from the user's browser.
  return NextResponse.redirect(absoluteUrl(`/secure-chat/verified?status=${status}`));
}
