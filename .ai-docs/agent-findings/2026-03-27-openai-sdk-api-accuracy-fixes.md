---
type: anti-pattern
severity: medium
affected_files:
  - /home/vince/dev/skills/src/skills/ai-provider-openai-sdk/SKILL.md
  - /home/vince/dev/skills/src/skills/ai-provider-openai-sdk/reference.md
  - /home/vince/dev/skills/src/skills/ai-provider-openai-sdk/examples/openai-sdk.md
  - /home/vince/dev/skills/src/skills/ai-provider-openai-sdk/examples/embeddings-vision-audio.md
standards_docs:
  - .ai-docs/standards/skill-atomicity-bible.md
  - .ai-docs/standards/skill-atomicity-primer.md
date: 2026-03-27
reporting_agent: skill-summoner
category: testing
domain: shared
root_cause: convention-undocumented
---

## What Was Wrong

1. **Wrong typed array class**: SKILL.md claimed embedding responses return `Float64Array` but the SDK actually returns `Float32Array` (verified via openai-node v6.1.0 source: `toFloat32Array()` is called internally).

2. **Stale redirect stub**: `examples/openai-sdk.md` was a deprecated redirect file left behind after content was split into topic files. The atomicity bible explicitly states: "Old monolithic example files should be deleted once content is moved to core.md + topic files -- do not leave redirect stubs."

3. **Incomplete streaming event signatures in reference.md**: The `.stream()` helper events table had simplified signatures missing properties that exist in the actual SDK (e.g., `parsed` on `content.delta`/`content.done`, `index`/`parsed_arguments`/`arguments_delta` on tool call events, and missing `refusal.delta`/`refusal.done` events entirely).

4. **Missing `zodResponsesFunction` helper**: The SDK exports `zodResponsesFunction` (for Responses API function tools) but the skill only documented `zodFunction` (for Chat Completions). Both are needed since the skill covers both APIs.

5. **Incomplete TTS voice list**: The TTS example function type union only listed 6 voices while the SDK supports 10 (missing: `ash`, `ballad`, `coral`, `sage`).

## Fix Applied

1. Changed `Float64Array` to `Float32Array` with clarifying note about internal base64 decoding in SKILL.md
2. Deleted `examples/openai-sdk.md` redirect stub
3. Updated reference.md streaming events table with accurate, complete signatures from SDK source
4. Added `zodResponsesFunction` to reference.md helper functions section and SKILL.md auto-detection keywords
5. Updated TTS voice type union in embeddings-vision-audio.md to include all 10 voices

## Proposed Standard

When auditing AI provider skills, always verify API claims against the actual SDK source code (not just documentation). Typed array classes (`Float32Array` vs `Float64Array`), event signatures, and helper function exports should be checked by reading the SDK source on GitHub, not relying on memory or cached knowledge.
