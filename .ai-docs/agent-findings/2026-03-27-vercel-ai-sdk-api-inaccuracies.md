---
type: anti-pattern
severity: medium
affected_files:
  - skills/src/skills/ai-orchestration-vercel-ai-sdk/SKILL.md
  - skills/src/skills/ai-orchestration-vercel-ai-sdk/reference.md
  - skills/src/skills/ai-orchestration-vercel-ai-sdk/examples/chat.md
  - skills/src/skills/ai-orchestration-vercel-ai-sdk/examples/core.md
standards_docs:
  - .ai-docs/standards/skill-atomicity-primer.md
date: 2026-03-27
reporting_agent: skill-summoner
category: architecture
domain: web
root_cause: enforcement-gap
---

## What Was Wrong

Three API inaccuracies in the Vercel AI SDK v6 skill, verified against Context7 docs (`/vercel/ai/ai_6.0.0-beta.128`):

1. **`DefaultChatTransport` wrong import source**: Imported from `@ai-sdk/react` in chat.md, but v6 exports it from `ai` package.

2. **`convertToModelMessages()` falsely claimed async**: SKILL.md red_flags and reference.md migration table stated the function is async in v6. Context7 API docs confirm it is synchronous, returning `ModelMessage[]` not `Promise<ModelMessage[]>`.

3. **`toTextStreamResponse()` used for useChat routes**: v6 introduces `toUIMessageStreamResponse()` specifically for routes serving `useChat` hooks. The skill uniformly used `toTextStreamResponse()` which is only correct for plain text streaming endpoints.

Additionally, two atomicity violations (Category 8 framework-specific names): pattern titles named "Next.js" specifically instead of using generic "Route Handler" naming.

## Fix Applied

- Changed `DefaultChatTransport` import to `from 'ai'`
- Removed async claim from `convertToModelMessages()` in SKILL.md and reference.md
- Updated useChat-serving route handlers to use `toUIMessageStreamResponse()`
- Kept `toTextStreamResponse()` in RAG streaming endpoint (correct for plain text)
- Added both methods to reference.md quick reference
- Genericized "Next.js" pattern titles to framework-agnostic names

## Proposed Standard

Add to `.ai-docs/standards/skill-atomicity-primer.md` under "API verification":

> When verifying API accuracy, check not just function names but also: (1) which package exports each symbol, (2) whether functions are sync vs async, and (3) which response helper method is appropriate for the use case (e.g., `toUIMessageStreamResponse()` vs `toTextStreamResponse()`).
