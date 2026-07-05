# Quick Start Guide - Aurora Studio

## 🚀 When Importing into New Workspace/Account

This guide ensures your project loads with the **exact UI, settings, and state from when you last left it**.

---

## ⚡ Install the CLI (Optional)

The Aurora CLI is published to npm. Install globally to drive generations from your terminal:

```bash
npm install -g aurora-studio
aurora login           # opens browser → /cli/authorize device flow
aurora generate --prompt "neon street performance" --out shot.png
```

- Package: [`aurora-studio`](https://www.npmjs.com/package/aurora-studio) v0.3.1
- Source: `cli/` directory in this repo
- Auth: device-code flow via `/api/public/cli/device/start` + `/poll`
- Releases: pushing a tag like `cli-v0.3.2` triggers `.github/workflows/publish-cli.yml` (requires `NPM_TOKEN` repo secret — Classic Automation token, Read & Publish)

---

## Step 1: Clone/Import Repository

```bash
git clone https://github.com/josephcrown920/aurora-charm-forge-87e3e757.git
cd aurora-charm-forge-87e3e757
```

---

## Step 2: Install Dependencies

```bash
bun install
# or
npm install
```

---

## Step 3: Set Environment Variables

### Copy the example file:
```bash
cp .env.example .env.local
```

### Fill in your keys:
```bash
# Required (Existing Providers)
LOVABLE_API_KEY=your_key_here
SUPABASE_URL=your_url
SUPABASE_ANON_KEY=your_key
REPLICATE_API_KEY=your_key  # Optional, uses Gemini as fallback

# New Providers (Optional - Orchestration Has Fallbacks)
GEMINI_API_KEY=your_key              # Free image generation
HEYGEN_API_KEY=your_key              # Avatar lipsync
KLING_ACCESS_KEY=your_key            # Video generation
KLING_SECRET_KEY=your_key
FAL_KEY=your_key                     # Catch-all fallback
OPENROUTER_API_KEY=your_key          # Text inference

# Monetization (Optional)
PAYSTACK_SECRET_KEY=your_key         # Payment webhooks

# Tracking (Optional)
HF_TOKEN=your_huggingface_token      # Free image generation alternative
```

**Note:** App works with just `LOVABLE_API_KEY`. Other keys enable additional features but aren't required.

---

## Step 4: Database Setup

### Check Supabase for Migrations
```bash
# If using Supabase, ensure these tables exist:
# - generations (+ new 'input_videos' JSON field)
# - user_webhooks
# - gift_cards
# - affiliates
# - affiliate_events

# If tables don't exist, run migrations:
bun run migrate  # or your migration command
```

---

## Step 5: Start Development Server

```bash
bun run dev
# or
npm run dev
```

Server starts at `http://localhost:5173`

---

## Step 6: Verify UI Loads Correctly

Open `http://localhost:5173` and check:

- ✅ **Header** — Aurora logo, navigation visible
- ✅ **Sidebar** — Left sidebar with menu items (if not collapsed)
- ✅ **Studio Page** — `/studio` route shows generation interface
- ✅ **Motion Studio** — `/motion` route loads without errors
- ✅ **Lipsync Gallery** — `/lipsync` route displays gallery
- ✅ **Dashboard** — `/dashboard` shows user stats
- ✅ **Dark Theme** — Page uses dark mode (colors: #1A1A1A background, white text)
- ✅ **Providers Visible** — Check browser console for provider status

### If UI Doesn't Load Correctly:

```bash
# 1. Clear cache
rm -rf .next node_modules/.cache

# 2. Restart dev server
bun run dev

# 3. Hard refresh browser
Ctrl+Shift+R (Windows/Linux)
Cmd+Shift+R (macOS)

# 4. Check console for errors
F12 → Console tab

# 5. Verify UI state file loaded
Check: src/config/ui-state.ts exists
```

---

## Step 7: Deploy Settings

### Preview Build:
```bash
bun run build
bun run preview
# Visit http://localhost:4173
```

### Deploy to Production:
```bash
# If using Vercel:
vercel deploy

# If using Netlify:
netlify deploy

# If using Docker:
docker build -t aurora-studio .
docker run -p 3000:3000 aurora-studio
```

---

## 📋 Verification Checklist

```
- [ ] Dependencies installed (bun install)
- [ ] .env.local created with required keys
- [ ] Database tables verified in Supabase
- [ ] Dev server started (bun run dev)
- [ ] UI loads at http://localhost:5173
- [ ] Studio page accessible
- [ ] Motion route works
- [ ] Console shows no critical errors
- [ ] Dark theme applied
- [ ] Provider status logged
```

---

## 🔧 Common Issues

### Issue: "Cannot find module 'src/config/ui-state.ts'"
**Fix:** Run `bun install` again, then restart dev server

### Issue: "Provider not available"
**Fix:** Check `.env.local` has correct API keys. App still works with just `LOVABLE_API_KEY`

### Issue: "Database connection failed"
**Fix:** Verify `SUPABASE_URL` and `SUPABASE_ANON_KEY` in `.env.local`

### Issue: "UI looks different from last time"
**Fix:** Check `src/config/ui-state.ts` and run: `git checkout src/config/ui-state.ts`

---

## 📚 Reference Files

For detailed information, see:

- **UI Snapshot** → `UI_SNAPSHOT.md` (visual reference of current state)
- **Features** → `FEATURE_SUMMARY.md` (what's new in v1.0)
- **PR Details** → `PR_DESCRIPTION.md` (technical deep-dive)
- **Testing** → `TESTING_GUIDE.md` (how to test features)
- **Changelog** → `CHANGELOG.md` (release notes)
- **Copilot Context** → `.copilot-context.md` (AI reference)
- **CLI Release** → `docs/CLI_RELEASE.md` (how to cut a new CLI version)

---

## 🆘 Need Help?

1. Check the relevant file above
2. Run `bun run dev` with console open (F12)
3. Check error messages
4. Verify all env vars are set
5. Clear cache and restart

---

**Last Updated:** 2026-06-13  
**Version:** 1.1.0 (CLI Release)  
**Branch:** main
