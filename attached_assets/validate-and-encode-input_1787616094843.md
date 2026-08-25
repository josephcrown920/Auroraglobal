---
name: Validate and encode untrusted input
description: Use whenever the app accepts input from any source the server doesn't control — form fields, query/path params, headers, JSON/API request bodies, file uploads, webhooks, third-party API responses, and LLM output — to prevent SQL/NoSQL/command injection, XSS, and SSRF through allow-list validation, parameterized/safe APIs, and contextual output encoding.
---

**Activation:** On-demand — fires when handling any externally-controlled input. Guardrail + actionable: Agent applies validation, parameterized queries, and output encoding in the code it writes.

# Instructions

Treat every value the server did not itself produce as untrusted: form fields, query/path params, headers/cookies, request bodies, uploaded files, webhook payloads, third-party API responses, and LLM output. AI-generated code frequently skips this, so it is the highest-priority application-security control. Apply OWASP's layered defense — validation stops bad data entering, a safe API stops it being interpreted as code, and encoding stops it executing on output.

Apply all three layers (OWASP Injection Prevention rules):
- Validate input, allow-list first: define what is valid (type, length, format, range, enum) and reject everything else, rather than trying to block known-bad. Canonicalize before validating. Note OWASP's caveat: validation alone is not a complete defense — it must be combined with the layers below.
- Use a safe / parameterized API (preferred): for databases use parameterized queries / prepared statements or the ORM — never build SQL/NoSQL by concatenating input. For OS commands, pass the command and each argument separately and validate against an allow-list — never interpolate input into a shell string. For LDAP/XPath, use the proper escaping/parameter API.
- Encode on output, per context: when rendering untrusted data, encode for the exact sink — HTML body, HTML attribute, JavaScript, URL, or CSS. In the browser, set text/values rather than innerHTML; rely on the framework's auto-escaping and don't bypass it (e.g. avoid dangerouslySetInnerHTML / v-html with untrusted data). This is what prevents XSS.

Specific high-risk sinks:
- SQL/NoSQL → parameterized queries / ORM (never string-built queries).
- HTML/DOM → contextual output encoding / framework auto-escaping (prevents XSS).
- OS commands → separate args + allow-list (avoid shelling out at all if possible).
- Outbound requests built from user input (URLs, hostnames) → validate against an allow-list of permitted hosts/schemes and block internal/metadata addresses to prevent SSRF; don't fetch arbitrary user-supplied URLs.
- File uploads → validate type/size, store via App Storage, generate server-side names.
- LLM output used in code/queries/DOM → validate and encode it like any other untrusted input before acting on it.

When building any input-handling code, state which inputs you treated as untrusted and which of the three layers (validate / parameterize / encode) you applied at each sink. Never claim an endpoint is safe from injection or XSS without parameterized queries and output encoding in place. Source: OWASP Injection Prevention, SQL Injection Prevention, Cross-Site Scripting Prevention, and SSRF Prevention cheat sheets (cheatsheetseries.owasp.org).
