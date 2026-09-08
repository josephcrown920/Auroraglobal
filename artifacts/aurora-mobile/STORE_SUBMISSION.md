# Aurora Performance Studio — Store Submission Pack

## Store listing copy

**App name:** Aurora Performance Studio  
**Subtitle / short description:** Direct cinematic AI visuals from your phone

**Description**

Aurora Performance Studio is the creative workspace for artists who want to direct their visual identity from their phone.

Start with a photo, clip, or idea. Stage a performance, build a cinematic image, change the world around a video, and keep every finished piece in one gallery. Aurora gives you focused creative controls for scenes, references, motion, and style—without a complicated desktop workflow.

Create for your next music release, campaign, portfolio, or social post. Your direction stays in the driver’s seat.

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
3. Complete each store’s data-safety/privacy questionnaire with the actual product behavior. This repo’s privacy policy URL is already set in `app.json`, but the questionnaires still require a human review.
4. Aurora currently hands billing off to web-based Paystack checkout. Review Apple and Google’s digital-goods payment rules with counsel or the relevant store policy team before submitting a build that exposes credit purchases. Android v1 remains consumption-only: no Play Billing or Aura top-ups.
5. Test sign-in, generation, gallery, sharing, image-library permission, and the Paystack handoff on a real device before promoting beyond internal testing.

## Build and submission paths

### iOS — App Store

Use Replit’s **Publish** flow for the Aurora mobile artifact / Expo Launch. It builds the iOS binary and supports App Store submission. Before upload, increment `ios.buildNumber` for each subsequent build in `app.json`.

### Android — Google Play internal testing

Run the EAS preflight from the repository root first:

```bash
bash scripts/eas-preflight.sh
```

The production profile in `eas.json` produces an Android App Bundle (`.aab`) with `versionCode` 2. Upload that AAB manually in Google Play Console:

1. Create or open the Aurora Performance Studio app record.
2. Go to **Testing → Internal testing** and create a release.
3. Upload the production `.aab`, add testers, and roll out to internal testing.
4. Test the install from the Google Play internal-test invite before moving to closed or production testing.

Google Play publishing is a manual Play Console step; it is not published directly from Replit.