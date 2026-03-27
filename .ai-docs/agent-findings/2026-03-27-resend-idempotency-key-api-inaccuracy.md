---
type: anti-pattern
severity: high
affected_files:
  - skills/src/skills/api-email-resend-react-email/SKILL.md
  - skills/src/skills/api-email-resend-react-email/examples/advanced-features.md
  - skills/src/skills/api-email-resend-react-email/examples/async-batch.md
standards_docs:
  - .ai-docs/standards/skill-atomicity-primer.md
date: 2026-03-27
reporting_agent: skill-summoner
category: architecture
domain: api
root_cause: convention-undocumented
---

## What Was Wrong

The Resend email skill documented idempotency keys as being passed inside the email payload's `headers` object:

```typescript
// WRONG — was in the skill
await resend.emails.send({
  ...payload,
  headers: { "Idempotency-Key": orderId },
});
```

The correct Resend Node.js SDK API passes idempotency keys as a **second argument** to `resend.emails.send()`:

```typescript
// CORRECT — per official Resend docs
await resend.emails.send(payload, {
  idempotencyKey: `order-confirmation-${orderId}`,
});
```

This is confirmed by the official Resend documentation at `resend.com/docs/dashboard/emails/idempotency-keys` and the engineering blog post at `resend.com/blog/engineering-idempotency-keys`.

## Fix Applied

Updated all three affected files:

- SKILL.md Pattern 6 snippet and Gotchas section
- advanced-features.md Pattern 2 implementation
- async-batch.md batch API limitations note

## Proposed Standard

The skill-atomicity-primer.md already mandates Context7/WebSearch API verification. This finding reinforces that AI-generated skills often have fundamentally wrong API signatures (not just outdated — structurally incorrect). Every SDK method call pattern should be verified against official documentation, especially for less common APIs like idempotency and webhook verification.
