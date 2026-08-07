import { useEffect, useState } from "react";

// Detect embedded/in-app browser contexts where WebAuthn (Face ID / passkeys)
// is typically blocked by the platform: iframes (e.g. the Replit preview),
// in-app webviews (Instagram, Facebook, TikTok, LinkedIn, Google app…), and
// iOS webviews that aren't real Safari. Password/OAuth sign-in still works in
// these contexts — only the passkey prompt gets denied.
export function isEmbeddedBrowser(): boolean {
  if (typeof window === "undefined") return false;
  let framed = false;
  try {
    framed = window.self !== window.top;
  } catch {
    framed = true; // cross-origin frame access throws → we're definitely framed
  }
  const ua = navigator.userAgent;
  const inAppWebview =
    /FBAN|FBAV|Instagram|Line\/|Twitter|TikTok|BytedanceWebview|musical_ly|Snapchat|LinkedInApp|GSA\/|DuckDuckGo\/|; wv\)/i.test(ua);
  // iOS webviews lack the "Safari/" token that real Safari and iOS browsers
  // (CriOS/FxiOS/EdgiOS ship it too) always include.
  const iosWebview =
    /iPhone|iPad|iPod/.test(ua) && !/Safari\//.test(ua);
  return framed || inAppWebview || iosWebview;
}

// Same check as a hook (evaluated after mount so SSR markup stays stable).
export function useEmbeddedBrowser() {
  const [embedded, setEmbedded] = useState(false);
  useEffect(() => setEmbedded(isEmbeddedBrowser()), []);
  return embedded;
}

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
