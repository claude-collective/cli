## Output Format

<output_format>
Provide your skill definition in this structure:

<skill_definition>

## Skill: {domain}-{subcategory}-{technology}

### Directory Location

`.claude/skills/{domain}-{subcategory}-{technology}/`

### metadata.yaml

```yaml
# yaml-language-server: $schema=https://raw.githubusercontent.com/claude-collective/cli/main/src/schemas/metadata.schema.json
category: [category]
author: [@author]
version: 1
cli_name: [Display Name]
cli_description: [5-6 words max]
usage_guidance: >-
  [When AI agent should invoke this skill - be specific about triggers]
requires: []
compatible_with: []
conflicts_with: []
tags:
  - [tag1]
  - [tag2]
```

### SKILL.md

````markdown
---
name: [Name]
description: [One-line description]
---

# [Name] Patterns

> **Quick Guide:** [1-2 sentence summary of when/why to use this technology]

---

<critical_requirements>

## ⚠️ CRITICAL: Before Using This Skill

> **All code must follow project conventions in CLAUDE.md** (kebab-case, named exports, import ordering, `import type`, named constants)

**(You MUST [domain-specific critical rule 1 - most important thing to remember])**

**(You MUST [domain-specific critical rule 2 - second most important])**

**(You MUST [domain-specific critical rule 3 - third most important])**

</critical_requirements>

---

**Auto-detection:** [comma-separated keywords that trigger this skill]

**When to use:**

- [Specific scenario 1]
- [Specific scenario 2]
- [Specific scenario 3]

**Key patterns covered:**

- [Core pattern 1]
- [Core pattern 2]
- [Core pattern 3]

---

<philosophy>

## Philosophy

[Why this technology exists, what problems it solves]

**When to use [Technology]:**

- [Use case 1]
- [Use case 2]

**When NOT to use:**

- [Anti-pattern scenario 1]
- [Anti-pattern scenario 2]

</philosophy>

---

<patterns>

## Core Patterns

### Pattern 1: [Name]

[Detailed explanation]

[Use `#### SubsectionName` markdown headers to organize content within patterns as needed. Common subsections include: Constants, Implementation, Usage, Hooks, Configuration - but only include what's relevant for this pattern.]

```[language]
// ✅ Good Example
// Complete, runnable code with explanatory comments
```

**Why good:** [Concise reasoning as comma-separated list - explain the consequence/benefit, not just facts]

```[language]
// ❌ Bad Example - Anti-pattern
// Code showing what NOT to do
```

**Why bad:** [Concise reasoning as comma-separated list - explain what breaks/fails, not just "missing X"]

[OPTIONAL - only include if not obvious from context:]
**When to use:** [Concise scenario - only when the choice isn't self-evident]

**When not to use:** [Concise anti-pattern - only when helpful to clarify boundaries]

---

### Pattern 2: [Name]

[Continue for all major patterns with embedded good/bad examples...]

</patterns>

---

<performance>

## Performance Optimization (OPTIONAL)

[Include only if performance is a significant concern. Cover: optimization patterns, caching strategies, etc.]

</performance>

---

<decision_framework>

## Decision Framework

[Decision tree or flow chart for choosing between approaches]

</decision_framework>

---

<integration>

## Integration Guide (OPTIONAL)

[How this technology integrates with the rest of the stack. Include only when the technology has meaningful interactions with other tools/libraries in your stack.]

**Works with:**

- [Technology X]: [How they integrate]
- [Technology Y]: [How they integrate]

**Replaces / Conflicts with:**

- [Technology Z]: [Why you wouldn't use both]

</integration>

---

<red_flags>

## RED FLAGS

**High Priority Issues:**

- ❌ [Anti-pattern 1 with explanation]
- ❌ [Anti-pattern 2 with explanation]

**Medium Priority Issues:**

- ⚠️ [Warning 1]
- ⚠️ [Warning 2]

**Common Mistakes:**

- [Mistake 1 and how to avoid]
- [Mistake 2 and how to avoid]

**Gotchas & Edge Cases:**

- [Quirk or surprising behavior 1 - not necessarily wrong, just tricky]
- [Edge case 2 that might trip people up]

</red_flags>

---

<critical_reminders>

## ⚠️ CRITICAL REMINDERS

> **All code must follow project conventions in CLAUDE.md** (kebab-case, named exports, import ordering, `import type`, named constants)

**(You MUST [domain-specific critical rule 1 - repeat from top])**

**(You MUST [domain-specific critical rule 2 - repeat from top])**

**(You MUST [domain-specific critical rule 3 - repeat from top])**

**Failure to follow these rules will [consequence - e.g., break functionality].**

</critical_reminders>
````

### reference.md (optional)

```markdown
# [Name] Quick Reference

[Condensed reference for quick lookups]
```

### examples/ (optional)

[List any example files needed]
</skill_definition>

<research_sources>

## Sources Used

| Source              | URL/Location  | What Was Used             |
| ------------------- | ------------- | ------------------------- |
| Official docs       | [url]         | [specific section]        |
| Codebase pattern    | [/path:lines] | [what pattern]            |
| Best practice guide | [url]         | [specific recommendation] |

</research_sources>

<skill_relationships>

## Relationship Analysis

**Requires (hard dependencies):**

- [skill-id] - [why required]

**Compatible with (works well together):**

- [skill-id] - [why compatible]

**Conflicts with (mutually exclusive):**

- [skill-id] - [why conflicts]

**Category:** [category]
</skill_relationships>

<validation>
## Skill Quality Checks

- [ ] Skill directory follows 3-part naming: `{domain}-{subcategory}-{technology}`
- [ ] SKILL.md exists with complete structure
- [ ] metadata.yaml exists with required fields
- [ ] All code examples are syntactically correct
- [ ] Examples follow the patterns described (no contradictions)
- [ ] Usage guidance is specific (not vague "use when needed")
- [ ] SKILL.md has TOC if > 100 lines
- [ ] No overlap with existing skills (checked against: [list])
- [ ] Tags are lowercase kebab-case
      </validation>
      </output_format>
