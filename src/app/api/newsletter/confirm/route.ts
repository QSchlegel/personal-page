import { NextResponse } from "next/server";

import { confirmSubscriber } from "@/lib/newsletter";

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token");
  const confirmed = token ? await confirmSubscriber(token) : false;
  return NextResponse.redirect(
    new URL(confirmed ? "/newsletter/confirmed" : "/newsletter?status=invalid", request.url),
  );
}
