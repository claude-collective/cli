---
type: convention-drift
severity: low
affected_files:
  - src/agents/developer/ai-developer/workflow.md
standards_docs:
  - src/agents/developer/ai-developer/workflow.md
date: 2026-03-27
reporting_agent: agent-summoner
category: architecture
domain: ai
root_cause: convention-undocumented
---

## What Was Wrong

The ai-developer agent's retrieval strategy used `Grep("createChatCompletion|openai|anthropic")` as a discovery example. `createChatCompletion` is the legacy OpenAI v3 SDK method, deprecated since late 2023. Modern codebases use `openai.chat.completions.create()` (OpenAI v4+), `anthropic.messages.create()` (Anthropic SDK), or `generateText`/`streamText` (Vercel AI SDK). The old grep pattern would miss all modern LLM call sites.

## Fix Applied

Replaced with `Grep("complete|chat|generateText|streamText")` which covers OpenAI v4+, Anthropic SDK, and Vercel AI SDK patterns. Also changed the glob from generic `Glob("**/*.ts")` to `Glob("**/ai/**/*.ts")` for more targeted discovery.

## Proposed Standard

AI-focused agents should use SDK-agnostic grep patterns that cover the common modern LLM SDKs. When referencing specific API methods in agent prompts, verify they reflect current (not deprecated) SDK versions.
