import type { ReactElement } from "react";
import { render } from "@react-email/render";
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

  // Render the template to HTML ourselves rather than passing `react` to
  // Resend. Resend would dynamically `import("@react-email/render")` at
  // runtime, which isn't resolvable from its own location once the package is
  // externalized — so we render here (render is a declared dependency, kept
  // unbundled via serverExternalPackages) and hand Resend plain HTML. The
  // try/catch keeps any render/transport failure from crashing the request.
  try {
    const html = await render(input.react);
    const { data, error } = await resend.emails.send({
      from: input.from ?? env.EMAIL_FROM,
      to: input.to,
      subject: input.subject,
      html,
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
