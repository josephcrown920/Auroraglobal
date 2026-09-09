---
name: EAS mobile builds from Replit
description: The three-layer failure mode that blocks EAS Android builds of artifacts/aurora-mobile from this Replit workspace, and the working recipe.
---

# EAS mobile builds from Replit

Working recipe (verified 2026-07-21, production .aab produced):
`cd artifacts/aurora-mobile && EAS_NO_VCS=1 npx eas-cli build --platform android --profile production --non-interactive --no-wait`, then poll `api.expo.dev/graphql` with EXPO_TOKEN. Android keystore already exists on EAS servers (remote credentials), so non-interactive works.

Three independent failures had to be fixed, in order:

1. **Package-manager detection is local, not archive-based.** EAS CLI picks the package manager from lockfiles present in the local project dir — `.easignore` does NOT affect detection. A stray `bun.lock` forced bun on the builder, where bun 1.2.x died with hundreds of ConnectionRefused tarball errors. Fix: delete `bun.lock` from the artifact dir entirely (package-lock.json is authoritative).

2. **The upload archive is controlled by the ROOT `.easignore`** (archive root = workspace root; app lives at `artifacts/aurora-mobile/` inside it). It had a line excluding `/artifacts/aurora-mobile/package-lock.json`, so the builder saw "No lockfile found" → yarn v1 fresh resolution → missing peer dep `react-native-worklets` → Babel "Cannot find module 'react-native-worklets/plugin'" at bundle time.

3. **Replit lockfiles are poisoned with firewall URLs.** `npm install` inside Replit writes `"resolved": "http://package-firewall.replit.local/npm/..."` for every package. That host doesn't exist on the EAS builder; `npm ci` dies with ONLY "npm error Exit handler never called!" (no real error printed). Fix: `sed -i 's|http://package-firewall.replit.local/npm/|https://registry.npmjs.org/|g' package-lock.json`. Integrity hashes stay valid.

**Why:** each layer produced a different cryptic error, and any future `npm install` in the artifact dir re-poisons the lockfile with firewall URLs.

**How to apply:** run `bash scripts/eas-preflight.sh` before any EAS build/upload — it checks (a) no bun.lock anywhere, (b) root .easignore includes the lockfile, and (c) auto-rewrites firewall URLs out of the mobile lockfile. Use `EAS_NO_VCS=1` always (eas-cli's git archiving is blocked in the agent sandbox). Verify upload contents locally with `eas build:inspect --stage archive`. EAS build logs are brotli-compressed JSONL (`brotli -d`).

## Android capability and preview checks

Do not conflate the iOS-only Expo Launch submission flow with Android build availability. Consult the current official Android upload guide before telling the user Android builds are unavailable: https://docs.replit.com/build/mobile-upload-android.

**Why:** Android builds authenticated successfully from this workspace even when older guidance described mobile publishing as iOS-only. Google Play upload remains a separate user-controlled step.

**How to apply:** Verify the build capability independently of store submission. The Expo-host screenshot URL can fail despite a healthy local Metro server; the shared `/aurora-mobile/` proxy can also load HTML but miss root-relative bundles. A direct local Playwright capture distinguishes those preview-routing failures from an actual app crash; it does not prove native-device behavior.
