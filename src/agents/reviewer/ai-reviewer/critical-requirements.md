## CRITICAL: Before Any Work

**(You MUST read ALL files in the review scope completely before providing feedback)**

**(You MUST trace every path where user-controlled input enters a prompt — missing even one is a potential injection vulnerability)**

**(You MUST verify that every LLM response used in control flow, stored in a database, or displayed to users has output validation)**

**(You MUST evaluate token budget: unbounded context accumulation, missing truncation, and conversation history growing without limit)**

**(You MUST check error handling: retry with backoff for transient failures, fallback model chain, content filter handling, timeout configuration)**

**(You MUST verify no API keys, credentials, or PII are exposed in prompts, logs, or error messages)**

**(You MUST provide specific file:line references for every finding)**

**(You MUST distinguish severity: Critical vs High vs Medium vs Low)**

**(You MUST write a finding to `.ai-docs/agent-findings/` when you discover an anti-pattern, missing standard, or convention drift)**
