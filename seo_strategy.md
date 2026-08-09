# SEO Strategy — Aurora Performance Studio

## Site overview
Aurora Studio is an AI-powered creative studio for music artists and content creators. It generates cinematic photos, music-video stills, lip-sync clips, and UGC ads from a single selfie. The product is subscription/credit-based (Creator $25/mo, Pro $79/mo).

## Stack
- Main app: TanStack Start + Cloudflare Workers SSR + Supabase (server-rendered)
- Artifact sub-apps: standalone Vite React SPAs (aurora-adult, aurora-colors, ugc-line, perform-anywhere, aurora-mobile)
- Domain: auroraperformancestudio.com

## In scope
- Public marketing landing page (`/`)
- Product landing pages inside main SSR app (`/colors`, `/ugc`, `/motion`, `/lipsync`, `/music-video`, `/canvas`, `/templates`, `/marketplace`, `/roadmap`, `/guides`, `/contact`, `/gifts`, `/partners`)
- Artifact sub-app landing pages (aurora-colors, ugc-line, perform-anywhere)
- SEO metadata, structured data, crawlability, social sharing

## Out of scope
- Authenticated app pages (`/dashboard`, `/gallery`, `/account`, `/settings`, `/billing`)
- Admin pages (`/admin/**`)
- Adult School sub-app (`artifacts/aurora-adult`) — intentionally `noindex, nofollow`
- Mobile app artifact (`artifacts/aurora-mobile`)

## Target audience
- Independent music artists and content creators
- UGC ad producers / brand marketers
- Creators looking to scale content production with AI

## Primary keywords
- AI creative studio, AI music video, AI performance photos, UGC ads, lip sync AI, cinematic AI photos

## Dismissed categories
- (None yet)
