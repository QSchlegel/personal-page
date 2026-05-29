import { startAuthentication, type PublicKeyCredentialRequestOptionsJSON } from "@simplewebauthn/browser";

import { authClient } from "@/lib/auth-client";

type PasskeySignInResult = Awaited<ReturnType<typeof authClient.signIn.passkey>>;

const INTERNAL_TRANSPORT = "internal";
const REGISTERED_FLAG = "qs-passkey-registered";

/**
 * Remember (per browser) that a passkey was registered here, so on return we
 * attempt a silent sign-in instead of pushing the user back into registration
 * — which previously created a fresh throwaway account on every visit.
 */
export function markPasskeyRegistered(): void {
  try {
    window.localStorage.setItem(REGISTERED_FLAG, "1");
  } catch {
    // storage blocked (private mode) — non-fatal, sign-in still works
  }
}

export function hasRegisteredPasskeyHint(): boolean {
  try {
    return window.localStorage.getItem(REGISTERED_FLAG) === "1";
  } catch {
    return false;
  }
}

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
 *
 * When the server returns no allowCredentials (the usernameless / discoverable
 * flow — there's no session yet, so it can't scope to a user) we leave them
 * empty and let the platform offer whatever resident passkeys it has, including
 * synced ones. Previously this returned null and bailed, which broke sign-in for
 * users who had already registered.
 */
function toPlatformOnly(
  optionsJSON: PublicKeyCredentialRequestOptionsJSON,
): PublicKeyCredentialRequestOptionsJSON {
  const allowCredentials = optionsJSON.allowCredentials;

  if (!allowCredentials?.length) {
    return optionsJSON;
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
