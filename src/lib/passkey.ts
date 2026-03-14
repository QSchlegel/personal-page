import { startAuthentication, type PublicKeyCredentialRequestOptionsJSON } from "@simplewebauthn/browser";

import { authClient } from "@/lib/auth-client";

type PasskeySignInResult = Awaited<ReturnType<typeof authClient.signIn.passkey>>;

const INTERNAL_TRANSPORT = "internal";

export function hasPasskeySupport() {
  return typeof window !== "undefined" && typeof window.PublicKeyCredential !== "undefined";
}

export async function hasLocalPasskeySupport() {
  if (!hasPasskeySupport()) {
    return false;
  }

  const publicKeyCredential = window.PublicKeyCredential as typeof PublicKeyCredential & {
    isUserVerifyingPlatformAuthenticatorAvailable?: () => Promise<boolean>;
  };

  if (typeof publicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable !== "function") {
    return false;
  }

  try {
    return await publicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch {
    return false;
  }
}

/**
 * Restrict WebAuthn options to platform-only (internal) transport.
 * Returns null when there are no credentials to authenticate against,
 * so the caller can skip the WebAuthn modal entirely and fall through
 * to registration.
 */
function toPlatformOnly(
  optionsJSON: PublicKeyCredentialRequestOptionsJSON,
): PublicKeyCredentialRequestOptionsJSON | null {
  const allowCredentials = optionsJSON.allowCredentials;

  // No credentials registered — nothing to authenticate against.
  if (!allowCredentials?.length) {
    return null;
  }

  // Force every credential to internal transport only.
  // This prevents Chrome from showing QR-code / security-key options.
  return {
    ...optionsJSON,
    allowCredentials: allowCredentials.map((credential) => ({
      ...credential,
      transports: [INTERNAL_TRANSPORT],
    })),
  };
}

/**
 * Ensure an authenticated session exists so passkey registration can proceed.
 * If no session, silently creates a bootstrap user via email signup.
 */
export async function ensureSessionForPasskey(): Promise<{ ok: boolean; error?: string }> {
  const session = await authClient.getSession();
  if (session.data?.user?.id) {
    return { ok: true };
  }

  const id = crypto.randomUUID();
  const result = await authClient.signUp.email({
    email: `passkey-${id}@local.invalid`,
    password: id,
    name: "Passkey User",
  });

  if (result.error) {
    return { ok: false, error: result.error.message ?? "Could not create session." };
  }

  return { ok: true };
}

function toPasskeyError(message: string, code = "AUTH_CANCELLED"): PasskeySignInResult {
  return {
    data: null,
    error: {
      code,
      message,
      status: 400,
      statusText: "BAD_REQUEST",
    },
  } as PasskeySignInResult;
}

export async function signInPasskeyOnThisDevice(): Promise<PasskeySignInResult> {
  const optionsResponse = await authClient.$fetch<PublicKeyCredentialRequestOptionsJSON>(
    "/passkey/generate-authenticate-options",
    {
      method: "GET",
      throw: false,
    },
  );

  if (!optionsResponse.data) {
    return optionsResponse as PasskeySignInResult;
  }

  const platformOptions = toPlatformOnly(optionsResponse.data);

  if (!platformOptions) {
    return toPasskeyError("No passkeys registered on this device.", "NO_CREDENTIALS");
  }

  try {
    const response = await startAuthentication({
      optionsJSON: platformOptions,
    });

    const verified = await authClient.$fetch<{ session: unknown; user: unknown }>("/passkey/verify-authentication", {
      method: "POST",
      body: {
        response,
      },
      throw: false,
    });

    if (!verified.error) {
      authClient.$store.notify("$sessionSignal");
    }

    return verified as PasskeySignInResult;
  } catch (error) {
    if (error instanceof Error) {
      return toPasskeyError(error.message);
    }
    return toPasskeyError("Passkey sign-in failed.");
  }
}
