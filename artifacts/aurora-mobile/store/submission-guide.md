# Aurora Studio — Store Submission Guide

> Last updated: 2026-07-22

## Current Status

| Item | Status | Notes |
|---|---|---|
| App icon 1024×1024 | ✅ | `assets/images/icon.png` |
| Splash screen | ✅ | `assets/images/splash.png` |
| Play feature graphic 1024×500 | ✅ | `assets/images/feature-graphic.png` |
| Privacy policy live | ✅ | https://auroraperformancestudio.com/privacy |
| Terms of Service live | ✅ | https://auroraperformancestudio.com/terms |
| Store listing copy | ✅ | `store-listing.md` |
| `app.json` configured | ✅ | Bundle ID, permissions, EAS project ID |
| `eas.json` production profiles | ✅ | Android AAB + iOS store distribution |
| EAS project linked | ✅ | ID `9927fad2-c399-4ae3-8727-614a2c751184` (`@nbajoshs-organization/aurora-performance-studio`) |
| EXPO_TOKEN authenticated | ✅ | Account: `nbajosh` / org: `nbajoshs-organization` |
| **Android production AAB** | ✅ | Build `1c5efc61` finished 2026-07-21. Archive: see EAS dashboard |
| Screenshots (device resolution) | ⬜ | Capture on real device — see resolutions below |
| `google-play-service-account.json` | ⬜ | Create from Google Play Console → needed to `eas submit` Android |
| iOS Apple Developer credentials | ⬜ | Needs Apple Developer account ($99/yr) + App Store Connect app record |
| `eas.json` Apple IDs filled in | ⬜ | Replace `FILL_IN_FROM_APP_STORE_CONNECT` + `FILL_IN_FROM_DEVELOPER_PORTAL` |
| iOS production build | ⬜ | Run after Apple credentials are set up |
| Android Play Store submission | ⬜ | Run `eas submit` after adding service account key |
| iOS App Store submission | ⬜ | Run `eas submit` after iOS build + credentials |

---

## Step 1 — Submit the Ready Android Build

The Android AAB (build `1c5efc61`) is already finished. To upload it to the Play Store internal track:

### 1a. Create Google Play service account key

1. Go to [Google Play Console](https://play.google.com/console) → Setup → API access
2. Link to a Google Cloud project (or create one)
3. Create a service account with **Release Manager** role
4. Download the JSON key and save it as:
   ```
   artifacts/aurora-mobile/google-play-service-account.json
   ```
   > ⚠️ This file is in `.gitignore` — never commit it.

### 1b. Submit the Android build

```bash
cd artifacts/aurora-mobile
EXPO_TOKEN=$EXPO_TOKEN npx eas submit \
  --platform android \
  --id 1c5efc61-5ec9-47d8-a26b-26a079732e63
```

This uploads the AAB to the **internal testing** track in draft state. After reviewing in Play Console, promote to production.

---

## Step 2 — Build for iOS

### 2a. Set up Apple Developer credentials

1. Sign up / log in at [developer.apple.com](https://developer.apple.com) ($99/yr)
2. Create an app record in [App Store Connect](https://appstoreconnect.apple.com):
   - Bundle ID: `com.aurorastudio.app`
   - App name: `Aurora — AI Creative Studio`
3. Copy the **App ID** (numeric, e.g. `1234567890`) and **Team ID** (10-char string)
4. Update `eas.json`:
   ```json
   "submit": {
     "production": {
       "ios": {
         "ascAppId": "1234567890",       ← your App ID from App Store Connect
         "appleTeamId": "ABCD1234EF"     ← your Team ID from developer.apple.com
       }
     }
   }
   ```

### 2b. Run the iOS production build

EAS manages certificates and provisioning profiles automatically on first run.

```bash
cd artifacts/aurora-mobile
EXPO_TOKEN=$EXPO_TOKEN npx eas build \
  --platform ios \
  --profile production
```

The build takes ~20–30 minutes. EAS will prompt for Apple credentials once interactively.

### 2c. Submit to App Store Connect / TestFlight

```bash
EXPO_TOKEN=$EXPO_TOKEN npx eas submit \
  --platform ios \
  --latest
```

This uploads the IPA to TestFlight. From App Store Connect, submit for App Review when ready.

---

## Screenshots Required

### iOS (App Store)
- **6.9" (iPhone 16 Pro Max):** 1320×2868 px — REQUIRED
- **6.5" (iPhone 14 Plus):** 1284×2778 px — REQUIRED
- Format: JPEG or PNG, no alpha

### Android (Play Store)
- **Phone:** 1080×1920 px minimum — REQUIRED
- **Feature graphic:** 1024×500 px — ✅ already at `assets/images/feature-graphic.png`

### Suggested screenshot sequence (5 screens):
1. Studio screen — style picker + generate button
2. A generated performance shot result
3. Lip-sync video result (gallery card)
4. Credits / billing screen
5. Auth / sign-in screen

Capture with: Expo Go on a physical device, or Xcode Simulator (iOS) / Android Studio AVD.

---

## Quick Reference: Key IDs

| Field | Value |
|---|---|
| EAS Project | `@nbajoshs-organization/aurora-performance-studio` |
| EAS Project ID | `9927fad2-c399-4ae3-8727-614a2c751184` |
| Android package | `com.aurorastudio.app` |
| iOS bundle ID | `com.aurorastudio.app` |
| Latest Android build | `1c5efc61-5ec9-47d8-a26b-26a079732e63` (finished 2026-07-21) |
| Privacy policy | https://auroraperformancestudio.com/privacy |
| Support URL | https://auroraperformancestudio.com |
| Support email | support@auroraperformancestudio.com |
