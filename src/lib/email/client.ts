import type { ReactElement } from "react";
import { Resend } from "resend";

import { env } from "@/lib/env";

const resend = env.RESEND_API_KEY ? new Resend(env.RESEND_API_KEY) : null;

export function emailEnabled(): boolean {
  return resend !== null;
}

/** Marketing mail (newsletter) sender; falls back to the transactional from. */
export function newsletterFrom(): string {
  return env.NEWSLETTER_FROM ?? env.EMAIL_FROM;
}

interface SendEmailInput {
  to: string;
  subject: string;
  react: ReactElement;
  from?: string;
  headers?: Record<string, string>;
  replyTo?: string;
}

export interface SendResult {
  ok: boolean;
  id?: string;
  error?: string;
}

export async function sendEmail(input: SendEmailInput): Promise<SendResult> {
  if (!resend) {
    console.warn(`[email] RESEND_API_KEY not set — skipping "${input.subject}" to ${input.to}`);
    return { ok: false, error: "Email delivery is not configured." };
  }

  // resend.emails.send can throw (not just return an error) — e.g. while
  // rendering the React template. Catch it so a delivery problem degrades to a
  // handled failure instead of crashing the request with a 500.
  try {
    const { data, error } = await resend.emails.send({
      from: input.from ?? env.EMAIL_FROM,
      to: input.to,
      subject: input.subject,
      react: input.react,
      headers: input.headers,
      replyTo: input.replyTo,
    });

    if (error) {
      console.error("[email] send failed", error);
      return { ok: false, error: error.message };
    }
    return { ok: true, id: data?.id };
  } catch (error) {
    console.error("[email] send threw", error);
    return { ok: false, error: error instanceof Error ? error.message : "Email send failed." };
  }
}
