import { useEffect, useState } from "react";

// Detect browser WebAuthn platform-authenticator support
// (Face ID / Touch ID / Android fingerprint / Windows Hello).
export function useBiometricSupport() {
  const [supported, setSupported] = useState(false);
  useEffect(() => {
    if (
      typeof window === "undefined" ||
      !window.PublicKeyCredential ||
      typeof window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable !== "function"
    ) return;
    window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()
      .then(setSupported)
      .catch(() => setSupported(false));
  }, []);
  return supported;
}
