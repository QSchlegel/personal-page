import { NextResponse } from "next/server";

import { confirmEmailVerificationLink } from "@/lib/passkey-email";

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token");
  const status = token ? await confirmEmailVerificationLink(token) : "invalid";
  return NextResponse.redirect(new URL(`/secure-chat/verified?status=${status}`, request.url));
}
