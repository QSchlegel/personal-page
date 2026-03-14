import { passkey } from "@better-auth/passkey";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";

import { env, getAuthOrigins, getRpIdFromUrl } from "@/lib/env";
import { prisma } from "@/lib/prisma";

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: "postgresql",
    usePlural: false,
    transaction: true,
  }),
  secret: env.BETTER_AUTH_SECRET,
  baseURL: env.BETTER_AUTH_URL,
  trustedOrigins: getAuthOrigins(),
  emailAndPassword: { enabled: true },
  plugins: [
    nextCookies(),
    passkey({
      rpName: "QS Portfolio",
      rpID: getRpIdFromUrl(env.BETTER_AUTH_URL),
      origin: getAuthOrigins(),
    }),
  ],
});

export type AuthSession = typeof auth.$Infer.Session;
