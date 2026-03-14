import { startAuthentication, type PublicKeyCredentialRequestOptionsJSON } from "@simplewebauthn/browser";

import { authClient } from "@/lib/auth-client";

type PasskeySignInResult = Awaited<ReturnType<typeof authClient.signIn.passkey>>;

const CLIENT_DEVICE_HINT = "client-device";
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

function withClientDeviceHint(
  optionsJSON: PublicKeyCredentialRequestOptionsJSON,
): PublicKeyCredentialRequestOptionsJSON {
  const allowCredentials = optionsJSON.allowCredentials;

  if (!allowCredentials?.length) {
    return {
      ...optionsJSON,
      hints: [CLIENT_DEVICE_HINT],
    };
  }

  const internalCredentials = allowCredentials.filter((credential) =>
    credential.transports?.includes(INTERNAL_TRANSPORT),
  );

  if (!internalCredentials.length) {
    return {
      ...optionsJSON,
      allowCredentials: [],
      hints: [CLIENT_DEVICE_HINT],
    };
  }

  return {
    ...optionsJSON,
    allowCredentials: internalCredentials,
    hints: [CLIENT_DEVICE_HINT],
  };
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

  try {
    const response = await startAuthentication({
      optionsJSON: withClientDeviceHint(optionsResponse.data),
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
