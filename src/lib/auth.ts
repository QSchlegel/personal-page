import { passkey } from "@better-auth/passkey";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";

import { env, getAuthOrigins, getCanonicalAuthUrl, getRpId } from "@/lib/env";
import { prisma } from "@/lib/prisma";

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: "postgresql",
    usePlural: false,
    transaction: true,
  }),
  secret: env.BETTER_AUTH_SECRET,
  baseURL: getCanonicalAuthUrl(),
  trustedOrigins: getAuthOrigins(),
  emailAndPassword: { enabled: true },
  plugins: [
    nextCookies(),
    passkey({
      rpName: "QS Portfolio",
      // rpID + origin both derive from the canonical public URL so registration
      // succeeds in production (the browser rejects an rpID that doesn't match
      // the page's domain — the original cause of broken passkey registration).
      rpID: getRpId(),
      origin: getAuthOrigins(),
      // Store passkeys on-device only. "platform" stops browsers from offering
      // roaming authenticators (security keys / QR "use a phone" hybrid flow),
      // and a required resident key makes it a real discoverable passkey.
      // Enforced server-side so it applies to every registration path,
      // independent of the client query param.
      authenticatorSelection: {
        authenticatorAttachment: "platform",
        residentKey: "required",
        requireResidentKey: true,
        userVerification: "preferred",
      },
    }),
  ],
});

export type AuthSession = typeof auth.$Infer.Session;
