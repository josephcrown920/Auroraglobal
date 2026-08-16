# Aurora Studio — Store Submission Guide

> Last updated: 2026-08-15

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
| **Local AAB copy (never expires)** | ✅ | `store/builds/aurora-studio-v1.0.0-vc1-1c5efc61.aab` (65.5 MB, gitignored). sha256 `63688d070518e62c5bed6663ae123ab8328357c4b1de0658d4643324064c981f`. The EAS download link expires **2026-08-20** — after that, use this local copy. ⚠️ vc1 predates the store-policy fixes below — fine for a first internal-track smoke, but upload **vc2** for anything reviewers see. |
| **Store-policy compliance fixes (2026-08-15)** | ✅ | Purchase links AND all "top up" copy removed (Play/Apple digital-goods rule), in-app **account deletion** added (endpoint verified end-to-end incl. every storage namespace), unfinished Canvas tab hidden, `android.versionCode` → **2**. Ships in the vc2 build. |
| **Web account-deletion page** | ✅ | `/delete-account` — required by Play's account-deletion policy (web resource usable without reinstalling). Goes live with the next web publish. Use `https://auroraperformancestudio.com/delete-account` as the **deletion URL in the Play Data safety form**. Privacy policy updated to disclose it + retention. |
| **vc2 Android production AAB — UPLOAD THIS** | ✅ | `store/builds/aurora-studio-v1.0.0-vc2-70a20985.aab` (66.9 MB, gitignored) — EAS build `70a20985-edf7-4ebc-92fe-a215b9fc8d31`, finished 2026-08-15, versionCode 2. sha256 `f60c0ec1f6fc5980809c31ae5a9cd64694cc3c9f442a9400e8b527387e2eeb0f`. EAS download link expires ~2026-09-14; the local copy does not. |
| `.gitignore` excludes store binaries | ✅ | `store/builds/`, `*.aab` |
| Google Play Developer account | ⬜ | **Required first** — $25 one-time at play.google.com/console/signup (identity verification can take ~48h) |
| Android Play Store submission (internal track) | ⬜ | Manual upload in Play Console — see Step 3 |
| Screenshots (device resolution) | ⬜ | NOT needed for internal testing; required before the store listing / production |
| Pre-launch report checks | ⬜ | Review in Play Console after internal track upload |
| iOS Apple Developer credentials | ⬜ | Needs Apple Developer account ($99/yr) |
| `eas.json` Apple IDs filled in | ⬜ | Replace `FILL_IN_FROM_APP_STORE_CONNECT` placeholders |
| iOS production build | ⬜ | Run after Apple credentials are set up |
| iOS App Store submission | ⬜ | Deferred to the Apple App Store follow-up task — not part of this Android release |

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

## Step 3 — Upload the Ready Android Build (manual — primary path)

The signed AAB is already built and saved in this workspace. Per Replit's mobile publishing docs, the Android release is a **manual upload in Play Console** — no keys or CLI tooling involved; everything happens in the browser.

### 3a. Download the AAB to your computer

Use the **vc2** file in `artifacts/aurora-mobile/store/builds/` (named `...-vc2-70a20985.aab` once the build lands) → right-click → **Download**. It contains the store-policy fixes; the older `...-vc1-1c5efc61.aab` predates them and should only be used if you need to smoke-test before vc2 finishes.

### 3b. Create the app record in Play Console

1. [Play Console](https://play.google.com/console) → **Create app**
2. App name: **Aurora Studio** · Default language: English (US) · Type: **App** · Price: **Free**
3. Accept the declarations and create.

### 3c. Upload to the internal testing track

1. **Testing → Internal testing → Create new release**
2. On first upload, accept **Play App Signing** (Google manages the signing key — recommended, keep the default)
3. Drop in the `.aab` file → let it process → **Next → Save and publish** to internal testing
4. **Testers** tab → create an email list with your Gmail address(es) → save → copy the **opt-in link** → open it on an Android phone → install

Internal testing needs no screenshots and no full store listing — those come later, before production.

### 3d. (Optional, later) Automated submissions

Future releases follow the same manual Play Console upload: build, download the AAB, bump `versionCode`, upload in the Console (see "Rebuilding for a new release" below).

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
- **Free** — do **not** declare in-app purchases: v1 ships no in-app purchase products. (Google Play forbids selling digital credits in-app through non-Play checkout; if credits later ship via Google Play Billing, update this declaration.)
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
4. **Credits screen** — balance and history
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

Deferred to the Apple App Store follow-up task. When that task runs it will
follow Replit's documented Apple flow — nothing in section 8 should be
executed as part of the Android v1 release.

---

## Quick Reference: Key IDs

| Field | Value |
|---|---|
| EAS Project | `@nbajoshs-organization/aurora-performance-studio` |
| EAS Project ID | `9927fad2-c399-4ae3-8727-614a2c751184` |
| Android package | `com.aurorastudio.app` |
| iOS bundle ID | `com.aurorastudio.app` |
| Android build (ready, vc2) | `70a20985-edf7-4ebc-92fe-a215b9fc8d31` (finished 2026-08-15, versionCode 2 — the one to upload) |
| Android build (superseded, vc1) | `1c5efc61-5ec9-47d8-a26b-26a079732e63` (2026-07-21, predates policy fixes) |
| Play Data safety — deletion URL | `https://auroraperformancestudio.com/delete-account` (live after next web publish) |
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

The new build ID will appear in the EAS dashboard and in the CLI output. Download that build (`npx eas build:download --platform android --id <BUILD_ID>`), save it under `store/builds/`, and upload it **manually in Play Console** (bump `versionCode` first) — the Console upload is always the submission step.
