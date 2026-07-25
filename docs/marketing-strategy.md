# Aurora — Marketing Strategy

## 1. Product snapshot
Aurora is an AI creator studio (image/video/lipsync generation, UGC ads, template studio) priced on a credit currency ("Aura"): a free monthly allowance on the Free tier, a $15/mo Pro tier (200 Aura/mo + perks), and one-time top-up packs (Starter/Creator/Studio). Growth levers already in the product: gift cards, an affiliate program (20% recurring), and referral attribution on signup.

## 2. Personas

**1. Indie music artist / performer ("Maya")** — releases singles independently, needs performance visuals and lyric/promo videos without hiring a production team. Price-sensitive, discovers tools via TikTok/Instagram creator communities and Discord servers.

**2. Small-brand / DTC marketer ("Jordan")** — runs a Shopify or DTC store, needs UGC-style ad creative fast and cheap for paid social testing. Values speed-to-output and volume (many variants) over a single perfect asset. Discovers via ad-creative communities, Twitter/X, and word of mouth from other founders.

**3. Content creator / agency ("Priya")** — manages multiple client accounts or a personal content pipeline (avatars, templates, batch generation). High usage, most likely Pro subscriber, most likely to become an affiliate since she already has an audience or client roster to refer.

## 3. Positioning
"Aurora turns a single photo or idea into studio-quality content — performance shots, UGC ads, lip-synced video — in minutes, at a fraction of a production budget."

Differentiation vs. generic AI image/video tools: purpose-built creator workflows (performance stills with identity lock, UGC ad templates, lipsync), transparent credit pricing, and a real referral/affiliate economy instead of a flat SaaS fee.

## 4. Channels (ranked by expected CAC efficiency)

1. **Referral / affiliate program (owned, near-zero CAC)** — the single highest-leverage channel Aurora already has built. 20% recurring commission is generous enough to motivate creators with even modest followings. Priority: make the CTA impossible to miss in-app (see growth mechanics below) and give affiliates ready-to-post creative (before/after grids, template showcases).
2. **Short-form organic (TikTok/Reels/Shorts)** — before/after transformations and "typing a prompt → result" screen-recordings are native to the format and cheap to produce from real user output (with permission). Target Maya and Priya personas directly.
3. **Communities** — music-producer Discords, indie-artist subreddits, DTC/ecommerce founder Slacks/Discords. Low cost, high trust; works best paired with a limited-time promo code for the community (trackable, gives moderators something concrete to share).
4. **Paid social retargeting (later stage)** — once organic + referral prove the funnel, retarget site visitors who didn't convert with a first-purchase promo code (see growth mechanics). Hold until organic CAC signal exists.
5. **SEO / template pages** — long-tail pages per template ("AI UGC ad generator", "AI lyric video maker") capture high-intent search traffic cheaply over time; lower priority than the above but compounding.

## 5. Pricing funnel fit
- Free tier (monthly Aura) is the top of funnel — low-friction trial, no card required.
- First-purchase nudge email (new) targets Free users who never converted — a small window to offer a discount promo code before they churn.
- Re-engagement email (new) targets users who signed up but went quiet — win-back before they forget the product exists.
- Gift cards let existing users become a distribution channel by gifting Aura to people outside Aurora's existing funnel entirely.
- Affiliate program converts happy high-usage users (Priya persona) into a recurring acquisition channel with aligned incentives (they only earn when their referral actually pays).

## 6. Growth mechanics being shipped alongside this doc
- **Promo codes** (admin-issued, distinct from gift cards): percent-off discount codes for checkout campaigns (community partnerships, paid social retargeting) and flat-bonus codes for signup incentives — both single-use per account, expirable, capped.
- **Lifecycle emails**: re-engagement (inactive signed-up users) and first-purchase nudge (Free users who never bought Aura), sent via a scheduled cron job through Resend, deduped against `email_log`.
- **Referral CTA prominence**: a persistent, visible card in the dashboard (not just the landing page) so existing logged-in users — the people most likely to actually convert a referral — are reminded the affiliate program exists.

## 7. 30/60/90-day plan

**Days 0–30 — Foundations**
- Ship promo codes, lifecycle emails, and the dashboard referral CTA (this task).
- Issue 2–3 community-specific promo codes and share them with 3–5 relevant Discord/subreddit communities.
- Start posting 3x/week short-form before/after content from real (permissioned) user generations.

**Days 31–60 — Instrument & iterate**
- Track promo code redemption rates, lifecycle email open/click/conversion, and affiliate signups sourced from the new dashboard CTA.
- A/B the first-purchase nudge subject line and discount depth (e.g. 10% vs. 15%) using two promo codes.
- Recruit 5–10 high-usage users directly into the affiliate program with a personal outreach email (not just relying on discovery).

**Days 61–90 — Scale what works**
- Double down on whichever organic channel (short-form vs. communities) shows the best signup→paid conversion.
- If referral-sourced revenue is meaningful, consider a limited-time affiliate commission boost (e.g. 30% for a launch month) to accelerate affiliate signups.
- Begin SEO template landing pages for the 3 highest-usage template categories, targeting long-tail template-specific search queries.

## 8. Success metrics
- Signup → first paid purchase conversion rate (baseline, then track lift from first-purchase nudge + promo codes).
- 30-day retention / re-activation rate from the re-engagement email.
- % of new paid users attributed to referral/affiliate codes (`referred_by_code` on `profiles`).
- Promo code redemption rate and net revenue impact (discount cost vs. incremental conversions).

---

## Founder positioning notes (July 2026)

**Sell transformations, not features.** Every section should answer "What can I create?" not "What feature do we have?":
- Create Your Album Rollout → cover art, promo photos, lyric videos, social posts
- Perform Anywhere → any stage, any city, any world
- Launch 30 Days of Content → TikTok30
- Direct Every Detail → AI Director (Scene Builder)
- Build Your Signature Look → Character DNA + Style DNA
- Film With Hollywood Camera Moves → Cinematic Camera

**Be the AI studio for musicians first.** Musicians already spend on: cover art, promo photos, music videos, lyric videos, performance visuals, rollouts, social, EPKs, merch mockups, ads. Homepage journey:
1. Build your artist (Character DNA, Style DNA)
2. Create your visuals (Image Studio, Photoshoot Pro, Studio Sets)
3. Produce your performance (Perform Anywhere, AI Director, Cinematic Camera)
4. Grow your audience (TikTok30, UGC Studio, Lyric Studio)

Tagline candidate: "Everything an artist needs to launch a release. One studio."

**Brand voice:** consistent cinematic language throughout the product — Direct, Studio, Performance, Scene, Take, Cast, Lighting, Roll Camera, Wrap, Production.

**Naming:** Lip Sync → "Performance Studio"; GRWM feature → "GRWM Studio". Positioning line: "Aurora is the AI operating system for creators."
