# Aurora Performance Studio — Store Submission Pack

## Store listing copy

**App name:** Aurora Performance Studio  
**Subtitle / short description:** Direct cinematic AI visuals from your phone

**Description**

Aurora Performance Studio is a mobile creative workspace for artists, performers, and content creators.

Generate AI images and videos from a prompt or reference photo. Choose camera motion for video, use Perform Anywhere to stage a photo or transform a short performance clip, and return to completed work in the gallery.

Generation consumes Aura credits. The mobile app displays the available balance, pricing, and credit history, but contains no Aura top-up control or payment link. Users can delete their account in the app.

**Keywords**

AI video, AI image generator, performance video, creative studio, music video, creator tools, cinematic, Aurora Performance Studio

**Privacy policy:** https://auroraperformancestudio.com/privacy  
**Support:** https://auroraperformancestudio.com

## Screenshot deliverables

Run `npm run store-assets` from `artifacts/aurora-mobile` to recreate the launch-creative gallery.

- `store-assets/ios/` — four 1290 × 2796 PNG source graphics for the 6.7-inch iPhone App Store slot.
- `store-assets/android/` — four 1440 × 2560 PNG source graphics (9:16) plus `feature-graphic.png` at 1024 × 500 for Google Play.
- For the Play listing, capture the matching screens from the actual Android app at the recommended 1080 × 1920 portrait size; these generated graphics are reference/launch creative and do not replace device captures.
- Keep the screenshot order numbered. The first three communicate the primary value, the Perform Anywhere differentiator, and the gallery outcome.

## Pre-submission checklist

1. Confirm the App Store Connect and Google Play Console app records use `com.aurorastudio.app`.
2. Capture and upload the matching device gallery; do not mix device sizes in an App Store screenshot set. Use `store-assets/` as the visual source when composing those captures.
3. Complete each store’s content-rating, declarations, and data-safety/privacy questionnaires with the actual product behavior. No rating or declaration is established by this document; each requires owner review in the relevant console.
4. Confirm the submitted mobile build remains consumption-only, with no Aura top-ups, purchase controls, or payment links.
5. Test sign-in, image generation, video generation, camera motion, Perform Anywhere, gallery, credit usage/history, image-library permission, and account deletion on a real device before promoting beyond internal testing.
6. Google Play developer verification is reported complete by the owner, but has not been audited in Play Console as part of this repository review.

## Build and submission paths

### iOS — App Store

Use Replit’s **Publish** flow for the Aurora Performance Studio mobile artifact / Expo Launch. It builds the iOS binary and supports App Store submission. Before upload, increment `ios.buildNumber` for each subsequent build in `app.json`.

### Android — Google Play internal testing

Run the EAS preflight from the repository root first:

```bash
bash scripts/eas-preflight.sh
```

The current Android configuration uses `versionCode` 3. The production [vc3 build `0e0b090b`](https://expo.dev/accounts/nbajoshs-organization/projects/aurora-performance-studio/builds/0e0b090b-4766-45a0-92ae-0c991fdeab9b) **FAILED** with status `ERRORED` on 2026-09-09, as confirmed by the build watcher. Its remote failure details have not been inspected, so this document does not assert a root cause. The existing vc2 AAB carries OLD branding and is not recommended for upload. After the build issue is investigated, create a fresh vc3 Android App Bundle (`.aab`), confirm its version code and branding, then upload it manually in Google Play Console:

1. Create or open the Aurora Performance Studio app record.
2. Go to **Testing → Internal testing** and create a release.
3. Upload the production `.aab`, add testers, and roll out to internal testing.
4. Test the install from the Google Play internal-test invite before moving to closed or production testing.

Google Play publishing is a manual Play Console step; it is not published directly from Replit.