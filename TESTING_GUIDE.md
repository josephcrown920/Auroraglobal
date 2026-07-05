# Testing Guide for Motion/Lipsync PR

## Pre-Flight Checklist

### Dependencies & Environment
```bash
# 1. Install dependencies
bun install

# 2. Set up environment variables
cat > .env.local << 'EOF'
# Required (existing)
LOVABLE_API_KEY=your_lovable_key
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_anon_key

# New providers (optional — fallbacks work without)
GEMINI_API_KEY=your_gemini_key
HEYGEN_API_KEY=your_heygen_key
KLING_ACCESS_KEY=your_kling_access_key
KLING_SECRET_KEY=your_kling_secret_key
FAL_KEY=your_fal_key
OPENROUTER_API_KEY=your_openrouter_key

# Monetization (if testing)
PAYSTACK_SECRET_KEY=your_paystack_secret_key

# Webhooks (can test without real services)
EOF

# 3. Start dev server
bun run dev
```

---

## Feature Tests

### 1. Motion Studio (New Route)
**Route:** `/motion`

**Steps:**
1. Navigate to `http://localhost:5173/motion`
2. Verify page loads without errors
3. Check console for any React warnings
4. Verify landing page demo reels display:
   - Split Reality video player (autoplays)
   - Avatar Studio video player (autoplays)
   - Both linked to their respective studios

**Expected Behavior:**
- Videos autoplay muted
- Hover effects on cards work
- Click through to /motion and /lipsync routes

**Pass/Fail:** ✅ / ❌

---

### 2. HeyGen Panel
**Route:** `/studio` (or wherever avatar generation is available)

**Steps:**
1. Locate HeyGen panel in generation UI
2. Select an avatar (e.g., Josh, Emily)
3. Select a voice (e.g., "Male 1 (US)")
4. Select a background (e.g., "Office")
5. Enter script text (max 2000 chars)
6. Click "Generate with HeyGen"

**Expected Behavior:**
- Button disabled until script is entered
- Loading spinner appears on click
- Toast message after submission
- Generation appears in gallery if `HEYGEN_API_KEY` configured

**Pass/Fail:** ✅ / ❌

---

### 3. Provider Orchestration Fallback
**Test:** Verify priority chain is followed

**Setup:**
1. Configure ONLY `HF_TOKEN` (HuggingFace)
2. Leave `REPLICATE_API_KEY` empty
3. Leave `LOVABLE_API_KEY` empty

**Steps:**
1. Trigger image generation in studio
2. Check server logs for orchestration chain

**Expected Logs:**
```
[orchestrator] Attempting image generation
  Provider 1 (gemini-direct): not configured, skipping
  Provider 2 (huggingface): ✓ attempting...
  [SUCCESS] Generated via huggingface
```

**Pass/Fail:** ✅ / ❌

---

### 4. Lipsync Gallery
**Route:** `/lipsync`

**Steps:**
1. Navigate to `/lipsync`
2. Verify gallery displays past lipsync renders (if any)
3. Check each item shows:
   - Thumbnail
   - Prompt text
   - Status (completed/processing)
   - Delete button

**Expected Behavior:**
- Gallery loads without errors
- Items ordered by creation date (newest first)
- Delete removes item from gallery

**Pass/Fail:** ✅ / ❌

---

### 5. Replicate Connector Banner
**Route:** `/studio` or any generation route

**Setup:**
1. Leave `LOVABLE_CONNECTOR_REPLICATE_API_KEY` and `REPLICATE_API_KEY` empty
2. Configure other providers

**Steps:**
1. Navigate to studio
2. Look for amber warning banner at top
3. Verify banner shows:
   - "Replicate connector not linked"
   - List of active providers
   - Link to integration docs
   - Dismiss button (X)

**Expected Behavior:**
- Banner appears only when Replicate is unconfigured
- Dismiss persists (localStorage or session)
- Banner disappears if `REPLICATE_API_KEY` is configured

**Pass/Fail:** ✅ / ❌

---

### 6. Webhooks Registration
**Route:** `/dashboard/webhooks` (if implemented)

**Setup:**
1. Be logged in as authenticated user
2. Have a local webhook receiver (e.g., `webhook.site` or local server)

**Steps:**
1. Register webhook:
   ```bash
   curl -X POST http://localhost:5173/api/webhooks/register \
     -H "Content-Type: application/json" \
     -d '{
       "url": "https://webhook.site/your-uuid",
       "events": ["render_complete"],
       "active": true
     }'
   ```
2. Trigger generation (image or video)
3. Wait for generation to complete
4. Verify webhook fires:
   ```json
   {
     "event": "render_complete",
     "timestamp": "2026-06-11T14:30:00Z",
     "data": {
       "generationId": "...",
       "kind": "image",
       "duration": 12
     }
   }
   ```
5. Verify headers include:
   - `X-Aurora-Signature` (HMAC-SHA256)
   - `X-Aurora-Webhook-ID`
   - `X-Aurora-Event`

**Expected Behavior:**
- Webhook registered successfully
- Event fires on generation completion
- Signature validation passes

**Pass/Fail:** ✅ / ❌

---

### 7. Gift Card Redemption
**Route:** `/dashboard/gifts` (if implemented)

**Setup:**
1. Be logged in
2. Have gift card code (or create one via admin)

**Steps:**
1. Navigate to gifts page
2. Enter gift code (format: `GIFT-123456-abcdef`)
3. Click "Redeem"

**Expected Behavior:**
- Code validated
- Credits granted immediately
- Confirmation toast shown
- User credits updated in dashboard

**Pass/Fail:** ✅ / ❌

---

### 8. Affiliate Tracking
**Route:** `/dashboard/affiliates` (if implemented)

**Setup:**
1. Be logged in
2. Get your affiliate code

**Steps:**
1. Navigate to affiliates page
2. Verify you see:
   - Unique affiliate code
   - Share link format: `?ref=your_code`
   - Stats: clicks, conversions, earned
3. Share link with another user
4. New user signs up + purchases credits
5. Return to affiliates page after 24h

**Expected Behavior:**
- Click registered on link follow
- Conversion recorded on payment
- Payout calculated (20% commission by default)

**Pass/Fail:** ✅ / ❌

---

### 9. Paystack Webhook
**Route:** `/api/webhooks/paystack` (server-side)

**Setup:**
1. Configure `PAYSTACK_SECRET_KEY`
2. Use Paystack test keys

**Steps (Test Mode):**
1. Create payment in Paystack dashboard (test mode)
2. Mark as successful
3. Paystack sends webhook to your endpoint

**Verify:**
1. Webhook signature verified (HMAC-SHA512)
2. Payment marked as `succeeded` in DB
3. Credits granted to user
4. Affiliate conversion recorded (if ref code present)

**Expected Logs:**
```
[webhook] Paystack charge.success received
[webhook] Signature verified ✓
[webhook] Credits granted: 100 → user_id
[webhook] Affiliate conversion: +$5 → ref_code
```

**Pass/Fail:** ✅ / ❌

---

### 10. Email Templates
**Route:** `/api/emails/preview` (if implemented)

**Steps:**
1. Navigate to email preview page
2. Select template: "welcome-5-credits"
3. Verify rendered HTML shows:
   - Aurora branding
   - Welcome message
   - CTA button ("Open Studio")
   - Signature
4. Repeat for other templates:
   - render-complete
   - low-credit-nudge
   - weekly-digest
   - payment-receipt
   - gift-redeemed

**Expected Behavior:**
- All templates render without errors
- Links are absolute (full URLs)
- Colors and fonts match design

**Pass/Fail:** ✅ / ❌

---

### 11. Provider Status API
**Route:** `/api/providers/status`

**Steps:**
1. Call endpoint:
   ```bash
   curl http://localhost:5173/api/providers/status
   ```
2. Verify response includes all providers:
   ```json
   {
     "replicate": false,
     "lovable": true,
     "gemini": false,
     "openrouter": true,
     "openai": false,
     "fal": false,
     "huggingface": true,
     "sync": true,
     "kling": false,
     "heygen": false
   }
   ```

**Expected Behavior:**
- Only boolean flags returned (no secrets)
- Matches configured env vars
- Used by ConnectReplicateBanner

**Pass/Fail:** ✅ / ❌

---

### 12. GPU Worker Health
**Route:** `/api/workers/health` (admin)

**Steps:**
1. Call endpoint (admin auth required):
   ```bash
   curl http://localhost:5173/api/workers/health \
     -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
   ```
2. Verify response includes:
   - Worker list
   - Status (online/offline/degraded)
   - Heartbeat timestamp
   - Failure rate
   - Capacity

**Expected Behavior:**
- All configured workers appear
- Health calculated correctly
- Used by orchestration dashboard

**Pass/Fail:** ✅ / ❌

---

### 13. Color Export
**Route:** `/colors` (if implemented)

**Setup:**
1. Create a color palette in the Colors Studio

**Steps:**
1. Click "Export"
2. Choose format:
   - JSON
   - CSS
   - Tailwind
   - Image (if supported)
3. Verify download

**Expected Behavior:**
- Format correct and complete
- Can be imported into design tools
- Palette preserved

**Pass/Fail:** ✅ / ❌

---

### 14. Demo Reels Animations
**Route:** `/` (landing page) or `/motion`, `/lipsync`

**Steps:**
1. Scroll to demo reels section
2. Watch animations:
   - Floating effect on images
   - Shimmer sweep across each tile
3. Hover over tiles
4. Click through to studio

**Expected Behavior:**
- Smooth 60fps animations
- No jank or lag
- Links work correctly

**Pass/Fail:** ✅ / ❌

---

## Error Scenarios

### Scenario 1: All Providers Down
**Setup:** All provider keys empty or misconfigured

**Steps:**
1. Trigger generation
2. Verify error toast: "No providers available"

**Pass/Fail:** ✅ / ❌

---

### Scenario 2: Webhook Signature Invalid
**Setup:** Tamper with webhook payload

**Steps:**
1. Send webhook with wrong signature
2. Verify rejected with 401/403

**Pass/Fail:** ✅ / ❌

---

### Scenario 3: Rate Limit on Provider
**Setup:** Trigger many generations rapidly

**Steps:**
1. Attempt 10+ generations in quick succession
2. Verify fallback to next provider after cooldown

**Expected Logs:**
```
[provider] gemini rate limited, cooldown: 60s
[provider] Attempting huggingface next...
```

**Pass/Fail:** ✅ / ❌

---

## Performance Tests

### 1. Orchestration Selection (< 100ms)
```bash
time curl http://localhost:5173/api/generate \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"prompt":"test","kind":"image"}'
```
**Target:** Provider selected + route determined in < 100ms

**Pass/Fail:** ✅ / ❌

---

### 2. Webhook Dispatch (fire & forget)
```bash
# Trigger generation
# Measure webhook delivery time

curl http://webhook.site/logs
# Should show webhook received within 1-2 seconds
```

**Pass/Fail:** ✅ / ❌

---

## Load Testing (Optional)

```bash
# Use Apache Bench or hey
hey -n 100 -c 10 http://localhost:5173/api/providers/status

# Verify no memory leaks
# Monitor: ps aux | grep node
```

---

## Rollback Procedure

If issues occur:

```bash
# 1. Revert to previous commit
git revert <commit-sha>

# 2. Disable new features via feature flags (if implemented)
# MOTION_STUDIO_ENABLED=false

# 3. Contact support with logs from /api/debug/logs
```

---

## Sign-Off

**Tester Name:** ___________________  
**Date:** ___________________  
**Overall Status:** ✅ PASS / ❌ FAIL  
**Notes:**
```
(Add any issues found or deviations)
```

---

**For questions or issues:** See PR_DESCRIPTION.md or contact team.
