---
name: Handle personal and sensitive data
description: Use when building anything that collects, stores, logs, or transmits user data — sign-up, profiles, payments, uploads, analytics, logging — or when the user mentions PII, GDPR, CCPA, HIPAA, PCI, or privacy.
---
**Activation:** On-demand — fires when handling user data. Guardrail: it shapes how Agent stores/logs data; new regulated-data collection is escalated to you for review.

# Instructions

Treating all data the same is how PII ends up in logs or stored in plaintext, which is a compliance failure. Classify the data first, then minimize and protect it.

- Identify what kind of data the feature touches:
  - Credentials (passwords, keys, tokens): never store plaintext; hash passwords with bcrypt/argon2; keep keys in Secrets; never log them.
  - Regulated data (card numbers, CVV, SSN, health, passport, tax id): avoid storing it if possible. For payments, use a payment processor and store only a token or last-4, never the CVV. If you must store regulated data, encrypt it at rest and restrict access. Never log it.
  - Personal data (name, email, phone, address, date of birth, IP): collect only what the feature needs, protect it, and don't log it in the clear.
- Minimize: do not add sensitive fields "in case they're useful." Every sensitive field stored is liability and audit scope.
- Never write sensitive data to logs. Do not log whole request bodies or user objects. Log identifiers (like a user id), not contents. Redact known sensitive fields before logging.
- Protect in transit (HTTPS only) and at rest (hash passwords, encrypt regulated data). Do not send PII to third parties (analytics, model APIs, error trackers) unless that is intended and covered — scrub it first.
- Don't leak sensitive details in error messages shown to users.
- If the app stores personal data, build the data model so a user's records can be found and deleted/exported by user id (data-subject rights), and don't retain PII forever by default.

When introducing collection of regulated data or EU personal data, flag it for privacy/legal review rather than proceeding silently. When done, report which data classes the feature touches, what you avoided collecting, that nothing sensitive is logged in the clear, and how sensitive data is protected.
