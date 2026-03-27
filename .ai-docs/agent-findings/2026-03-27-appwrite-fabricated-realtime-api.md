---
type: anti-pattern
severity: high
affected_files:
  - src/skills/api-baas-appwrite/SKILL.md
  - src/skills/api-baas-appwrite/examples/realtime.md
  - src/skills/api-baas-appwrite/examples/core.md
  - src/skills/api-baas-appwrite/reference.md
standards_docs:
  - .ai-docs/standards/skill-atomicity-primer.md
  - .ai-docs/standards/skill-atomicity-bible.md
date: 2026-03-27
reporting_agent: skill-summoner
category: api-accuracy
domain: api
root_cause: enforcement-gap
---

## What Was Wrong

The Appwrite skill's entire Realtime section was built on fabricated APIs that do not exist in the Appwrite Web SDK:

1. **`Realtime` service class** — The skill imported `Realtime` from `"appwrite"` and instantiated it as `new Realtime(client)`. The Web SDK does NOT export a `Realtime` class. Realtime in the Web SDK is accessed via `client.subscribe()` directly on the `Client` instance.

2. **`Channel` helper class** — The skill used `Channel.tablesdb(dbId).table(tableId)`, `Channel.files()`, `Channel.account()` as type-safe channel builders. No such `Channel` class exists in the Appwrite Web SDK. Channels are raw strings like `"account"`, `"files"`, `` `databases.${dbId}.tables.${tableId}.rows` ``.

3. **`subscription.close()`** — The skill showed `await subscription.close()` for cleanup. In reality, `client.subscribe()` returns an unsubscribe function directly — you call `unsubscribe()`, not `subscription.close()`.

4. **`await realtime.subscribe()`** — The subscribe call was shown as async (awaited). In the Web SDK, `client.subscribe()` is synchronous and returns the unsubscribe function immediately.

5. **Realtime query filtering** — Pattern 6 in `realtime.md` showed passing `[Query.equal("roomId", ROOM_ID)]` as a third argument to `realtime.subscribe()` for server-side event filtering. This API does not exist.

6. **Event string prefix** — Events were written as `tablesdb.*.tables.*.rows.*.create`. The correct prefix is `databases.*.tables.*.rows.*.create`.

These fabrications would cause immediate runtime errors for any developer following the skill's patterns.

## Fix Applied

All six issues were corrected across four files:

- Removed `Realtime` from imports, exported `client` instead
- Replaced all `Channel.*` helpers with raw channel strings
- Changed `subscription.close()` to calling the returned unsubscribe function
- Removed `await` from subscribe calls
- Deleted the fabricated realtime query filtering pattern entirely
- Fixed event string prefix from `tablesdb.*` to `databases.*`
- Updated reference tables, auto-detection keywords, and red flags to match

## Proposed Standard

The skill-atomicity-primer.md already states "Use the Context7 MCP server to look up current documentation" and "Verify import paths, method signatures, config syntax, and CLI commands." This rule is correct but needs stronger enforcement. Specifically:

- When a skill teaches a **service class** (like `Realtime`) or **helper class** (like `Channel`), verify that class actually exists in the SDK's exports. AI-generated skills frequently fabricate convenience APIs that "should" exist but don't.
- When a skill shows a **method signature** (like `realtime.subscribe(channel, callback, queries)`), verify the actual parameter list. Fabricated optional parameters are a common hallmark.
- Add a specific check to the quality gate: "Verify every `import { X } from 'package'` against actual package exports."
