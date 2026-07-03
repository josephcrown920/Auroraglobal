---
name: Aura currency naming
description: The spendable currency is DISPLAYED as "Aura" but stored/coded as credits/ics; "Aurora" is the brand — never conflate them.
---

# Aura currency vs Aurora brand

The in-app spendable currency is **displayed to users as "Aura"** everywhere (counts, pricing, gifts, emails, legal, toasts, MCP human-readable error messages like "Not enough Aura").

**Never rename the code/storage side.** Internally the currency is `credits` (profile column + props `p.credits`/`r.credits`, `credits_reserved`, `credits_granted`) and legacy `ics` in RPC names (`grant_ics`, `reserve_ics`) / error code `insufficient_credits`. Email template keys (`welcome-5-credits`), MCP JSON field names (`total_credits`), and the lucide `CreditCard` icon are identifiers, not display copy — leave them.

**"Aurora" is the PRODUCT/BRAND** — never rename it to Aura: `Aurora` / `Aurora Studio` (nav, logo alt, `<title>`/meta/og), and feature/agent names `Aurora Canvas`, `Aurora CLI`, `Aurora MCP Server`, `Aurora Node`, `Aurora Agent`, `Aurora Concierge`, the `aurora` gifts-design KEY, and `aurora_*` localStorage keys.

**Special case:** "Out of AI credits. Add credits in workspace settings." in agent/chatbot functions refers to the AI *gateway* (Lovable/provider) credits, NOT app currency — leave unchanged. Provider-economics comments ("Lovable credits used last") are also unrelated.

**Why:** the user rebranded only the currency to "Aura" while keeping the Aurora brand. A blanket find/replace either breaks the brand or breaks DB/RPC contracts.
**How to apply:** when touching currency copy, change only human-visible STRING VALUES to "Aura"; verify with `rg "[0-9] Aurora|Aurora credits|[0-9] credits"` and confirm leftovers are brand names, identifiers, comments, or the AI-gateway special case.
