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
    }),
  ],
});

export type AuthSession = typeof auth.$Infer.Session;
