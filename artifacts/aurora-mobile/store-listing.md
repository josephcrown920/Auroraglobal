# Aurora Studio — Play Store Listing

## App Details

**Package Name:** com.aurorastudio.app
**Category:** Photography
**Content Rating:** Everyone
**Price:** Free (in-app purchases)

---

## Short Description (80 chars max)

AI-powered creative studio for generating stunning performance photos & videos.

---

## Full Description (4000 chars max)

**Aurora Studio** brings professional AI-powered creative tools to your fingertips. Designed for performers, musicians, content creators, and artists, Aurora transforms your photos into stunning performance shots, cinematic music video stills, and viral UGC content — all in seconds.

### What You Can Create

🌟 **Performance Shots** — Studio-quality portraits with professional lighting. Look like you just stepped off the stage at Madison Square Garden.

🎬 **Music Video Stills** — Cinematic editorial images in the style of your favorite music video directors. Perfect for single artwork, press releases, and promo material.

🎨 **Colors Studio** — Clean, vibrant cyclorama backgrounds in any color. The same look used by major record labels, available to every artist.

📱 **UGC Ads** — Authentic, TikTok-style content creator ads that convert. Natural lighting, candid feel, built to perform on social media.

✏️ **Custom Prompts** — Full creative control. Describe exactly what you want and our AI makes it happen.

### Features

✓ Sign in with email — no social login required
✓ Personal gallery of all your AI generations
✓ Share creations instantly to social media
✓ Transparent credit system — pay only for what you use
✓ Reference photo support for identity-consistent results
✓ Dark, premium UI designed for creative professionals

### How It Works

1. Choose your style preset
2. Optionally add a reference photo for identity consistency
3. Customize with your own text prompt
4. Hit Generate — your creation appears in seconds
5. Save to your gallery or share directly

### Credits

Aurora uses a simple credit system. Each generation costs 2 credits. Credits can be purchased at auroraperformancestudio.com — your balance syncs instantly to the app.

Credits never expire.

### Privacy

We take your privacy seriously. Your reference photos are used only for your specific generation request and are not stored permanently. View our full privacy policy at auroraperformancestudio.com/privacy.

---

## Screenshots Needed (for Play Store)

Capture screenshots at 1080×1920 (portrait) showing:
1. Studio screen with style picker and generate button
2. Gallery screen with generated content grid
3. A generated performance shot result
4. Credits screen with balance and top-up options
5. Auth/sign-in screen

---

## Feature Graphic

1024×500 px banner:
- Dark background (#0b0b14)
- Aurora logo (violet lightning bolt) on left
- App name "Aurora Studio" in bold white text
- Tagline: "AI Creative Studio for Artists"
- Purple gradient accent on right showing a sample generation

---

## Privacy Policy URL

https://auroraperformancestudio.com/privacy

## Support Email

support@auroraperformancestudio.com

---

## Build & Submission Notes

### EAS Build (Android APK for Play Store)

```bash
cd artifacts/aurora-mobile
npx eas build --platform android --profile production
```

This produces an `.aab` (Android App Bundle) for Play Store submission.

### For internal testing (APK):
```bash
npx eas build --platform android --profile preview
```

### Before submission, ensure:
1. `google-play-service-account.json` is placed in `artifacts/aurora-mobile/`
2. App icons are present at `assets/images/icon.png` (1024×1024)
3. Splash screen at `assets/images/splash.png` (1242×2436)
4. EAS project ID is set (run `npx eas init` if not set)
5. `versionCode` in `app.json` is incremented for each release

### Play Store internal track submission:
```bash
npx eas submit --platform android
```
