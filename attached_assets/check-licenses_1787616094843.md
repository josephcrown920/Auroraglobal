---
name: Check dependency licenses
description: Use this skill when adding dependencies or before releasing, or when the user asks whether a library is safe to use commercially or mentions open-source license or IP compliance.
---
**Activation:** On-demand — fires when adding a dependency or before release. Agent-actionable: it inspects dependency licenses itself; license-vs-policy calls are escalated to you.

# Instructions

Pulling a copyleft library into a proprietary product can legally require the company to open-source its own code. Picking a library for what it does without checking its license is a real IP risk.

- When adding a dependency to a closed-source or commercial product, check its license before committing to it.
- Permissive licenses (MIT, ISC, BSD, Apache-2.0) are generally safe to ship.
- Strong copyleft (GPL-2.0, GPL-3.0) and network copyleft (AGPL, SSPL) are high risk for proprietary software — AGPL and SSPL can trigger source-disclosure obligations even for a hosted service. Do not add these to a proprietary product without explicit legal sign-off.
- Weak copyleft (LGPL, MPL-2.0) is conditional — flag it and confirm the org's policy before relying on it.
- An unknown or missing license is not safe. A package with no stated license grants no rights by default. Find the real license before using it.
- If a library is flagged, first look for a permissively licensed alternative that does the same job and propose the swap. If none exists and the feature is essential, stop and ask — this is a business and legal decision, not an engineering one. Never strip or alter a library's license text to dodge the issue.

When done, report the licenses of any new dependencies and flag anything that is not clearly permissive for review.
