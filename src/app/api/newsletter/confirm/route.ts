import { NextResponse } from "next/server";

import { confirmSubscriber } from "@/lib/newsletter";
import { absoluteUrl } from "@/lib/site";

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token");
  const confirmed = token ? await confirmSubscriber(token) : false;
  // Redirect to the public origin, not request.url (internal 0.0.0.0:8080
  // behind the proxy).
  return NextResponse.redirect(
    absoluteUrl(confirmed ? "/newsletter/confirmed" : "/newsletter?status=invalid"),
  );
}
