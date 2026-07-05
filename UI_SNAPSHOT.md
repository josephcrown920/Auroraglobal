# UI Snapshot - Aurora Studio v1.0

**Date:** 2026-06-13  
**Version:** 1.1.0 (CLI Release)  
**Status:** Current production state

---

## 🎨 Visual & Layout Reference

Use this document when importing to new workspaces to verify the UI matches.

---

## Color Scheme

### Primary Colors
```
Background (Dark):  #1A1A1A
Text (Light):       #FFFFFF
Primary Blue:       #007AFF (Aurora Blue)
Secondary Blue:     #5AC8FA (Light Blue)
Accent Red:         #FF3B30
Accent Green:       #34C759
```

### UI Elements
```
Header Background:   #1A1A1A (dark)
Header Border:       #333333 (subtle)
Sidebar Background:  #1A1A1A
Sidebar Hover:       #2A2A2A
Card Background:     #2A2A2A
Card Border:         #333333
Button Primary:      #007AFF
Button Hover:        #0051D5
Button Disabled:     #666666
Input Background:    #1A1A1A
Input Border:        #333333
Input Focus:         #007AFF
Divider:             #333333
Success:             #34C759
Warning:             #FF9500
Error:               #FF3B30
```

---

## Layout Structure

### Desktop (> 1024px)
```
┌─────────────────────────────────────────┐
│           HEADER (80px)                 │
├──────────────┬─────────────────────────┤
│              │                         │
│   SIDEBAR    │      MAIN CONTENT      │
│   (250px)    │    (flex-1, max-w)     │
│              │                         │
├──────────────┴─────────────────────────┤
│          FOOTER (40px)                  │
└─────────────────────────────────────────┘
```

### Mobile (< 768px)
```
┌──────────────────────────┐
│    HEADER (60px)         │
├──────────────────────────┤
│                          │
│    MAIN CONTENT          │
│   (Full width)           │
│                          │
├──────────────────────────┤
│  FOOTER (40px)           │
└──────────────────────────┘

(Sidebar collapses to hamburger menu)
```

---

## Component Layout Details

### Header
- **Height:** 80px
- **Position:** Fixed top
- **Background:** #1A1A1A
- **Border Bottom:** 1px solid #333333
- **Contents:**
  - Logo (left)
  - Nav items (center)
  - User menu (right)
- **Z-index:** 1000

### Sidebar
- **Width:** 250px
- **Position:** Fixed left
- **Background:** #1A1A1A
- **Border Right:** 1px solid #333333
- **Collapsed Width:** 70px (icon-only mode)
- **Animation:** Smooth slide (200ms)
- **Contents:**
  - Logo (top)
  - Menu items (scrollable)
  - User profile (bottom)
- **Z-index:** 999

### Main Content
- **Padding:** 24px (desktop), 16px (mobile)
- **Max Width:** 1400px (centered)
- **Background:** #1A1A1A
- **Margin Top:** 80px (below header)
- **Margin Left:** 250px (right of sidebar)
- **Responsive:** Adjusts on mobile

### Footer
- **Height:** 40px
- **Position:** Fixed bottom
- **Background:** #1A1A1A
- **Border Top:** 1px solid #333333
- **Contents:** Copyright, links, status
- **Z-index:** 900

---

## Typography

### Font Family
```
Primary: Inter, system-ui, -apple-system, sans-serif
Monospace: JetBrains Mono, Courier New, monospace
```

### Font Sizes
```
H1: 32px, 700 weight, line-height 1.2
H2: 24px, 600 weight, line-height 1.3
H3: 20px, 600 weight, line-height 1.4
H4: 16px, 600 weight, line-height 1.5
Body: 16px, 400 weight, line-height 1.6
Small: 14px, 400 weight, line-height 1.5
XSmall: 12px, 400 weight, line-height 1.4
```

---

## Component Styles

### Buttons
```
Primary Button:
  Background: #007AFF
  Text: #FFFFFF
  Padding: 12px 16px
  Border Radius: 8px
  Font Size: 14px
  Font Weight: 600
  Hover: #0051D5
  Active: #003DAA
  Disabled: #666666, opacity 0.5
  Transition: 150ms

Secondary Button:
  Background: #2A2A2A
  Text: #FFFFFF
  Border: 1px solid #333333
  Padding: 12px 16px
  Border Radius: 8px
  Hover: #333333
  Active: #404040
```

### Cards
```
Background: #2A2A2A
Border: 1px solid #333333
Border Radius: 12px
Padding: 16px
Box Shadow: 0 2px 8px rgba(0,0,0,0.3)
Transition: box-shadow 200ms
Hover Shadow: 0 4px 12px rgba(0,0,0,0.4)
```

### Inputs
```
Background: #1A1A1A
Border: 1px solid #333333
Border Radius: 8px
Padding: 10px 12px
Font Size: 14px
Color: #FFFFFF
Focus Border: #007AFF
Focus Shadow: 0 0 0 3px rgba(0,122,255,0.1)
Placeholder Color: #999999
```

### Badges
```
Background: #2A2A2A
Text: #FFFFFF
Padding: 4px 8px
Border Radius: 4px
Font Size: 12px
Font Weight: 500

Variants:
  Success: bg-green-500, text-white
  Warning: bg-orange-500, text-white
  Error: bg-red-500, text-white
  Info: bg-blue-500, text-white
```

---

## Pages & Routes

### Landing Page (`/`)
- **Header:** Full-width gradient
- **Hero Section:** Large headline, CTA buttons
- **Features Section:** Feature cards grid
- **Demo Reels Section:** Video showcase (Motion & Lipsync)
- **CTA Section:** Call-to-action
- **Footer:** Links, copyright

### Studio Page (`/studio`)
- **Left Panel:** Input controls
  - Prompt textarea
  - Model selector
  - Generation options
  - Generate button
- **Right Panel:** Preview gallery
  - Generated images/videos
  - Status indicators
  - Download/Share buttons
- **Banner (if needed):** Connect Replicate prompt
- **Gallery:** Recent generations at bottom

### Motion Studio (`/motion`)
- **Layout:** Similar to studio
- **Controls:** Camera presets, lighting, pose selector
- **Preview:** Real-time preview
- **Gallery:** Motion generation history

### Lipsync Gallery (`/lipsync`)
- **Layout:** Grid gallery
- **Items:** Thumbnail, prompt, status, actions
- **Actions:** Play, delete, download
- **Empty State:** "No lipsync renders yet"

### Dashboard (`/dashboard`)
- **Sidebar:** Dashboard navigation
- **Header Section:** User stats (generations, credits, usage)
- **Cards Grid:**
  - Total generations
  - Credits used
  - API calls
  - Active providers
- **Charts:** Usage over time

### Webhooks (`/dashboard/webhooks`)
- **Header:** "Webhooks" title, add button
- **Table/List:** Registered webhooks
  - URL
  - Events
  - Status
  - Last triggered
  - Actions (edit, delete, test)
- **Add Webhook Form:** Modal or inline

### CLI Authorize (`/cli/authorize`)
- **Layout:** Centered card on dark background
- **Header:** "Authorize CLI" title
- **Body:** Device code display, "Approve" / "Deny" buttons
- **Backed by:** `/api/public/cli/device/start` and `/api/public/cli/device/poll`
- **Used by:** `aurora login` command in the `aurora-studio` npm package

---

## Animations & Transitions

### Standard Transitions
```
Button Hover: 150ms ease-in-out
Card Hover: 200ms ease-in-out
Menu Open/Close: 200ms ease-in-out
Modal Fade: 300ms ease-in-out
Sidebar Collapse: 300ms ease-in-out
```

### Special Animations
```
Demo Reels:
  - Floating effect: 6s ease-in-out infinite
  - Shimmer sweep: 2s ease-in-out infinite
  - Opacity fade on scroll

Loading States:
  - Spinner rotation: linear, 1s per rotation
  - Skeleton pulse: 1.5s ease-in-out infinite
  - Progress bar: smooth width transition
```

---

## Breakpoints

```
XSmall: < 480px
Small:  480px - 768px
Medium: 768px - 1024px
Large:  1024px - 1280px
XLarge: 1280px - 1536px
2XL:    > 1536px

Responsive Adjustments:
- Sidebar hidden on < 768px (hamburger menu)
- Single column layout on < 768px
- Reduced padding on mobile
- Smaller font sizes on mobile
- Simpler animations on reduced-motion
```

---

## Dark Mode Notes

- **Primary theme:** Dark (default)
- **Accent colors:** Bright blues and reds for contrast
- **Text contrast:** WCAG AA compliant (4.5:1 minimum)
- **No light mode:** Application is dark-only
- **Reduced motion:** Respects `prefers-reduced-motion`

---

## Current State Reference

### What's Visible on Launch
1. ✅ Header with Aurora logo
2. ✅ Sidebar with menu items
3. ✅ Main studio interface
4. ✅ Generation gallery
5. ✅ Provider status indicator
6. ✅ User profile dropdown

### What Should NOT Appear
1. ❌ Light mode toggle (dark-only)
2. ❌ Settings page (future)
3. ❌ Admin dashboard (admin-only)
4. ❌ Legacy UI elements

---

## Configuration Files

- **Colors:** `src/config/ui-state.ts` → theme colors
- **Layout:** Tailwind config (responsive breakpoints)
- **Fonts:** `tailwind.config.ts` → fontFamily
- **Animations:** Tailwind config → keyframes
- **Dark mode:** Tailwind `darkMode: 'class'`

---

## Verification Checklist

When importing to new workspace, verify:

```
- [ ] Header appears at top (80px)
- [ ] Logo visible in header
- [ ] Navigation items in header
- [ ] Sidebar visible on left (250px)
- [ ] Sidebar menu items present
- [ ] Main content area properly positioned
- [ ] All colors match color scheme above
- [ ] Text is white on dark backgrounds
- [ ] Buttons are blue with proper hover states
- [ ] Cards have proper shadow and border
- [ ] Footer visible at bottom
- [ ] Responsive on mobile (sidebar collapses)
- [ ] No layout overflow or broken elements
- [ ] Fonts look like Inter/system fonts
```

If any checks fail, see QUICK_START.md troubleshooting section.

---

**Last Updated:** 2026-06-13  
**Version:** 1.1.0 (CLI Release)  
**Verified:** Yes
