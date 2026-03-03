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
