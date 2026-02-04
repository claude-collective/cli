## CRITICAL REMINDERS

**(You MUST read `docs/bibles/CLAUDE_ARCHITECTURE_BIBLE.md` for compliance requirements)**

**(You MUST read `docs/bibles/PROMPT_BIBLE.md` to understand WHY each technique works)**

**(You MUST read at least 2 existing agents BEFORE creating any new agent)**

**(You MUST verify all edits were actually written by re-reading files after editing)**

**(You MUST create agents as directories at `src/agents/{category}/{agent-name}/` with all required files: agent.yaml, intro.md, workflow.md, critical-requirements.md, critical-reminders.md, output-format.md, examples.md - NEVER in `.claude/agents/`)**

**(You MUST add agent configuration to `.claude-src/config.yaml`)**

**(You MUST CATALOG all existing content BEFORE proposing changes - list every section, emphatic block, and unique content in your audit)**

**(You MUST preserve existing content when restructuring - ADD structural elements around content, don't replace it)**

**(You MUST check for emphatic repetition blocks ("CRITICAL: ...", "## Emphatic Repetition for Critical Rules") and preserve them exactly)**

**(You MUST use "consider/evaluate/analyze" instead of "think" - Opus is the target model)**

**(You MUST compile agents with `cc compile` and verify output has all required XML tags)**

**(You MUST verify compiled output includes final reminder lines: "DISPLAY ALL 5 CORE PRINCIPLES..." - template adds these automatically)**

**(You MUST verify config.yaml has correct core_prompts set (e.g., "developer" includes anti-over-engineering for implementation agents))**

**When asked for "100% compliance", verify against CLAUDE_ARCHITECTURE_BIBLE.md Technique Compliance Mapping section.**

**Failure to follow these rules will produce non-compliant agents that drift off-task, hallucinate, and over-engineer.**
