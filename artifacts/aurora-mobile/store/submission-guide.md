# Aurora Studio — Store Submission Guide

> Last updated: 2026-08-13

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
| **Android production AAB** | ✅ | Build `1c5efc61-5ec9-47d8-a26b-26a079732e63` finished 2026-07-21 |
| `.gitignore` excludes service account key | ✅ | `google-play-service-account.json` is excluded |
| Google Play Developer account | ⬜ | **Required first** — $25 one-time at play.google.com/console/signup |
| Screenshots (device resolution) | ⬜ | Capture on real device — see resolutions below |
| `google-play-service-account.json` | ⬜ | Create from Google Play Console — needed to `eas submit` Android |
| Android Play Store submission | ⬜ | Run `eas submit` after adding service account key |
| Pre-launch report checks | ⬜ | Review in Play Console after internal track upload |
| iOS Apple Developer credentials | ⬜ | Needs Apple Developer account ($99/yr) |
| `eas.json` Apple IDs filled in | ⬜ | Replace `FILL_IN_FROM_APP_STORE_CONNECT` placeholders |
| iOS production build | ⬜ | Run after Apple credentials are set up |
| iOS App Store submission | ⬜ | Run `eas submit` after iOS build + credentials |

---

## Step 1 — Create a Google Play Developer Account

If you haven't already:

1. Go to [play.google.com/console/signup](https://play.google.com/console/signup)
2. Pay the $25 one-time registration fee
3. Complete the account setup (takes ~48 hours to verify)

---

## Step 2 — Create a Play Console App Record

1. In [Google Play Console](https://play.google.com/console), click **Create app**
2. App name: **Aurora Studio**
3. Default language: English (United States)
4. App or game: **App**
5. Free or paid: **Free**
6. Accept the policies and create

---

## Step 3 — Submit the Ready Android Build

The Android AAB (build `1c5efc61`) is already finished. To upload it to the Play Store internal track:

### 3a. Create Google Play service account key

1. In Play Console → **Setup → API access**
2. Click **Link to a Google Cloud project** (or create one)
3. Under **Service accounts**, click **Create new service account**
4. In Google Cloud Console, give it the **Service Account** → **Release Manager** role
5. Back in Play Console, grant the service account access
6. In Cloud Console → IAM → Service Accounts → your account → **Keys → Add Key → JSON**
7. Save the downloaded JSON file as:
   ```
   artifacts/aurora-mobile/google-play-service-account.json
   ```
   > ⚠️ This file is in `.gitignore` — never commit it.

### 3b. Submit the Android build

```bash
cd artifacts/aurora-mobile
EXPO_TOKEN=$EXPO_TOKEN npx eas submit \
  --platform android \
  --id 1c5efc61-5ec9-47d8-a26b-26a079732e63
```

This uploads the AAB to the **internal testing** track in draft state.

---

## Step 4 — Pass the Pre-Launch Report

After uploading to the internal track, Google runs an automated pre-launch report (~1–2 hours). In Play Console → **Android Vitals → Pre-launch report**:

### Critical checks to pass:

| Check | What to look for |
|---|---|
| **Crashes** | 0 crashes on the robo test. If any: check the crash stack trace in the report and fix in the app code, then rebuild. |
| **Security flags** | No "uses cleartext traffic" if you've set `usesCleartextTraffic: false`. Aurora always uses HTTPS so this should pass. |
| **Permissions** | All declared permissions (`CAMERA`, `INTERNET`, `READ_MEDIA_IMAGES`) match `app.json`. |
| **Screenshots auto-generated** | Google takes screenshots during robo testing — these are NOT your store screenshots, just for internal review. |
| **Accessibility** | Touch targets ≥ 48dp, sufficient contrast. |

### Common pre-launch failures and fixes:

**ANR (App Not Responding)** — usually the splash screen not dismissing on slow devices. Check `expo-splash-screen` `hideAsync()` is called after fonts load.

**WebView SSL errors** — all API calls must be HTTPS. Aurora uses `https://auroraperformancestudio.com` which is fine.

**Missing network security config** — Expo automatically generates this for React Native apps; no action needed.

If the report shows issues, fix them in the app code and run:
```bash
cd artifacts/aurora-mobile
EXPO_TOKEN=$EXPO_TOKEN npx eas build --platform android --profile production
```
Then submit the new build ID.

---

## Step 5 — Complete the Store Listing in Play Console

Copy content from `store-listing.md` into Play Console:

### Main store listing
- **App name:** Aurora Studio
- **Short description:** AI-powered creative studio for generating stunning performance photos & videos.
- **Full description:** Copy from `store-listing.md` → Full Description section
- **App icon:** Upload `assets/images/icon.png` (1024×1024)
- **Feature graphic:** Upload `assets/images/feature-graphic.png` (1024×500)

### Screenshots (see Step 6 below)
- Upload at least 2 phone screenshots (1080×1920 recommended)

### Content rating
1. Play Console → **Content rating → Start questionnaire**
2. Category: **Utilities**
3. Answer: No violence, no sexual content, no user-generated content sharing publicly
4. Expected rating: **Everyone**

### Pricing & distribution
- **Free** (in-app purchases via Paystack)
- All countries (or restrict as needed)
- Check "Contains ads": No

---

## Step 6 — Screenshots

Capture using Expo Go on a real Android device, or Android Studio AVD:

### Android (Play Store) — minimum 2 required, up to 8
- **Dimensions:** 1080×1920 px (portrait)
- **Format:** JPEG or PNG
- **Feature graphic:** ✅ already at `assets/images/feature-graphic.png`

### Suggested sequence (5 screens):
1. **Studio screen** — style picker + generate button (most important)
2. **A generated result** — performance shot in gallery
3. **Gallery grid** — showing multiple past generations
4. **Credits screen** — balance and top-up
5. **Sign-in screen**

### How to take screenshots:
```bash
# Android device connected via USB (ADB):
adb exec-out screencap -p > screenshot.png

# Or use Android Studio → Device Manager → screenshot button
```

---

## Step 7 — Promote to Production

After internal testing passes:

1. Play Console → **Release → Production → Create new release**
2. Select the AAB you uploaded in Step 3b
3. Add release notes:
   ```
   First release! Aurora Studio brings AI-powered creative tools to performers, 
   musicians, and content creators. Generate studio-quality performance shots, 
   music video stills, and UGC content from a single selfie.
   ```
4. **Review and roll out to production** (start at 20% rollout if preferred)

---

## Step 8 — Build and Submit for iOS (optional, later)

### 8a. Set up Apple Developer credentials

1. Sign up at [developer.apple.com](https://developer.apple.com) ($99/yr)
2. Create an app record in [App Store Connect](https://appstoreconnect.apple.com):
   - Bundle ID: `com.aurorastudio.app`
   - App name: `Aurora — AI Creative Studio`
3. Copy the **App ID** (numeric) and **Team ID** (10-char string)
4. Update `eas.json`:
   ```json
   "submit": {
     "production": {
       "ios": {
         "ascAppId": "YOUR_NUMERIC_APP_ID",
         "appleTeamId": "YOUR_TEAM_ID"
       }
     }
   }
   ```

### 8b. Run the iOS production build

```bash
cd artifacts/aurora-mobile
EXPO_TOKEN=$EXPO_TOKEN npx eas build \
  --platform ios \
  --profile production
```

EAS manages certificates and provisioning profiles automatically. The build takes ~20–30 minutes.

### 8c. Submit to TestFlight

```bash
EXPO_TOKEN=$EXPO_TOKEN npx eas submit \
  --platform ios \
  --latest
```

---

## Quick Reference: Key IDs

| Field | Value |
|---|---|
| EAS Project | `@nbajoshs-organization/aurora-performance-studio` |
| EAS Project ID | `9927fad2-c399-4ae3-8727-614a2c751184` |
| Android package | `com.aurorastudio.app` |
| iOS bundle ID | `com.aurorastudio.app` |
| Android build (ready) | `1c5efc61-5ec9-47d8-a26b-26a079732e63` (finished 2026-07-21) |
| Privacy policy | https://auroraperformancestudio.com/privacy |
| Terms of service | https://auroraperformancestudio.com/terms |
| Support URL | https://auroraperformancestudio.com |
| Support email | support@auroraperformancestudio.com |

---

## Rebuilding (if needed)

If you make app changes and need a fresh build:

```bash
cd artifacts/aurora-mobile

# Increment versionCode in app.json android section first, then:
EXPO_TOKEN=$EXPO_TOKEN npx eas build \
  --platform android \
  --profile production
```

The new build ID will appear in the EAS dashboard and in the CLI output. Use that ID with `eas submit`.
