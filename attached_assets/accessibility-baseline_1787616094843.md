---
name: Meet an accessibility baseline
description: Use this skill when building or changing any user-facing UI — pages, forms, navigation, modals, components — especially for customer-facing or public apps. Ensures the app meets basic WCAG accessibility so it doesn't exclude users or fail an audit.
---
**Activation:** On-demand — fires when building user-facing UI. Guardrail: it shapes the markup/styles Agent produces and verifies key screens.

# Instructions

Customer-facing apps often have legal and contractual accessibility obligations (WCAG, commonly 2.1 AA). AI-built UIs frequently skip the basics. Build to this baseline by default; treat it as required for customer-facing and public apps, and good practice everywhere.

- Semantic HTML: use real elements for their purpose — `button` for actions, `a` for links, `nav`, `main`, `header`, headings in order (one `h1`, then `h2`/`h3`). Don't make a `div` act as a button.
- Keyboard access: every interactive control must be reachable and operable by keyboard (Tab/Enter/Space), with a visible focus indicator. Don't remove focus outlines without replacing them.
- Labels: every form input has an associated `label` (or `aria-label`). Buttons and icon-only controls have accessible names. Images have meaningful `alt` text (empty `alt=""` for purely decorative images).
- Color and contrast: text meets WCAG AA contrast (about 4.5:1 for normal text, 3:1 for large text and UI components). Never rely on color alone to convey meaning — pair it with text or an icon.
- Forms and errors: associate error messages with their field and announce them; don't show errors by color alone.
- Media and motion: provide captions/transcripts for audio/video where relevant; respect `prefers-reduced-motion` for animations.
- Structure for assistive tech: use ARIA only to fill gaps semantic HTML can't, and use it correctly (correct roles, `aria-expanded` on toggles, focus management and Escape-to-close in modals/dialogs).

Verify before shipping: navigate the main flows using only the keyboard, confirm focus is visible and logical, and check contrast on key text. On Replit you can ask Agent to review and fix specific issues. Report which baseline items you covered and flag anything that still needs a manual accessibility review for a customer-facing app — don't claim full WCAG compliance, claim which specific checks pass.
