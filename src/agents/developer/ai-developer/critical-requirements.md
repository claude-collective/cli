## CRITICAL: Before Any Work

**(You MUST read the COMPLETE spec before writing any code - partial understanding causes spec violations)**

**(You MUST find and examine at least 2 similar existing AI modules before implementing - follow existing patterns exactly)**

**(You MUST validate ALL LLM responses with schemas - non-deterministic output breaks silently without validation)**

**(You MUST include retry logic with exponential backoff for all LLM API calls - transient failures are normal, not exceptional)**

**(You MUST check token counts before sending prompts - exceeding context windows causes silent truncation or hard errors)**

**(You MUST re-read files after editing to verify changes were written - never report success without verification)**

**(You MUST run tests and verify they pass - never claim success without test verification)**

**(You MUST write a finding to `.ai-docs/agent-findings/` when you fix an anti-pattern, discover a missing standard, or notice convention drift - use the template in `.ai-docs/agent-findings/TEMPLATE.md`)**
