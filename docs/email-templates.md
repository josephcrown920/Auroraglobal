# Aurora email templates

All templates use the shared Aurora email shell: dark navy background, violet
accent, a compact content card, and one direct CTA. Links in this document are
the intended destinations, not email-provider tracking URLs.

## Signup and onboarding

| Template | Trigger and timing | Subject | Plain-text preview |
| --- | --- | --- | --- |
| `welcome-5-credits` | Sent once after an authenticated email signup; deduped by user. | Welcome to Aurora — 50 free Aura are waiting for you | Your new account has 50 Aura — enough for two portrait shots or one short lip-sync at the standard tier. Open Studio, choose a direction, and make your first creation. |
| `signup_welcome` | Sent once immediately after an email signup that returns an active session; deduped by user. | Welcome to Aurora — 50 free Aura are waiting for you | Your new account has 50 Aura — enough for two portrait shots or one short lip-sync at the standard tier. Open Studio and turn the blank page into something you can share. |
| `onboarding_done` | Sent by lifecycle cron after `onboarding_complete` is recorded. | You're set up on Aurora — start creating | Your studio is ready. Start from the visual direction you picked, try a UGC ad, or build a chain in Canvas. |
| `onboarding_resume` | Lifecycle cron, no sooner than 2 hours after onboarding was shown or skipped, only if onboarding is unfinished. | Finish your first creation — bonus Aura inside | You started setting up your studio but did not finish. Add a selfie, choose a look, and the onboarding bonus will be claimed when setup completes. |

## Generation and balance

| Template | Trigger and timing | Subject | Plain-text preview |
| --- | --- | --- | --- |
| `first_generation_complete` | After the first succeeded generation is finalized; one atomic claim per user. | Your first Aurora creation is ready | Your first Aurora creation is ready. The result thumbnail appears when the generation produced an image. Make another creation or return to your Gallery. |
| `render-complete` | Existing per-render notification after a render completes. | Your render just finished | Your image or video is ready. Open Gallery to grab it, share it, or use it as the base for the next one. |
| `low-credit-nudge` | Existing balance check at 5 Aura or below. | Your Aura is running low — top up to keep going | Your balance is low. The cheapest option is the 1-Day Pass — 150 Aura with a 150 Aura daily limit. Open Billing to keep creating. |
| `first_purchase_nudge` | Once for accounts 3–45 days old with no lifetime purchase. | Your free Aura is almost gone — keep creating | You have been creating with free Aura. The 1-Day Pass keeps the momentum going without waiting for a refresh. |

## Engagement and account

| Template | Trigger and timing | Subject | Plain-text preview |
| --- | --- | --- | --- |
| `re_engagement` | Cooldown-controlled lifecycle email only for accounts older than 14 days that have never generated. | Come back — your Aura is still here | Your Aura is still here. Open Studio and make the first piece in your catalog. |
| `weekly-digest` | Existing weekly activity digest, no more than once every 6 days. | Your week on Aurora | A summary of your image, video, and lip-sync output with a direct link back to Studio. |
| `daily_tip` | Existing daily creative tip, no more than once every 20 hours. | Daily Aurora creative prompt | One practical prompt or workflow idea to help you make the next piece today. |
| `payment-receipt` | Sent after a successful Aura purchase. | Receipt — Aura added | Your Aura purchase was successful, with the amount, reference, and balance grant shown. |
| `gift-redeemed` | Sent when a gift is redeemed. | You received Aura | Another creator sent Aura to your account. Open Studio and use it on your next creation. |
| `gift-card-delivery` | Sent after a gift card is created. | Your Aurora gift card is ready | Your gift card contains Aura or Aurora Pro time and includes a private redemption code. |
| `password_reset_acknowledged` | Sent after a password reset succeeds. | Your Aurora password was reset | Your password changed successfully. If this was not you, contact Aurora support. |
