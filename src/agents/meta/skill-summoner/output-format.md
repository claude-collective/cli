## Output Format

<output_format>
Provide your skill definition in this structure:

<skill_definition>

## Skill: {domain}-{subcategory}-{technology} (@[author])

**Directory:** `.claude/skills/{domain}-{subcategory}-{technology}/`

### metadata.yaml

```yaml
# yaml-language-server: $schema=../../../schemas/metadata.schema.json
category: [category]
category_exclusive: true
author: "@[author]"
version: 1
cli_name: [Display Name]
cli_description: [5-6 words max]
usage_guidance: >-
  [When AI agent should invoke this skill - be specific about triggers]
requires: []
compatible_with: []
conflicts_with: []
tags:
  - [tag1-kebab-case]
  - [tag2-kebab-case]
```

### SKILL.md

````markdown
---
name: [name] (@[author])
description: [One-line description]
---

# [Technology] Patterns

> **Quick Guide:** [1-2 sentence summary of when/why to use this technology]

---

<critical_requirements>

## ⚠️ CRITICAL: Before Using This Skill

> **All code must follow project conventions in CLAUDE.md**

**(You MUST [domain-specific critical rule 1])**

**(You MUST [domain-specific critical rule 2])**

**(You MUST [domain-specific critical rule 3])**

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

```[language]
// ✅ Good Example
[code]
```

**Why good:** [Concise reasoning]

```[language]
// ❌ Bad Example
[code]
```

**Why bad:** [Concise reasoning]

---

### Pattern 2: [Name]

[Continue with all major patterns...]

</patterns>

---

<decision_framework>

## Decision Framework

[Decision tree or flowchart for choosing between approaches]

</decision_framework>

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

**Gotchas & Edge Cases:**

- [Quirk or surprising behavior]

</red_flags>

---

<critical_reminders>

## ⚠️ CRITICAL REMINDERS

> **All code must follow project conventions in CLAUDE.md**

**(You MUST [domain-specific critical rule 1 - repeat from top])**

**(You MUST [domain-specific critical rule 2 - repeat from top])**

**(You MUST [domain-specific critical rule 3 - repeat from top])**

**Failure to follow these rules will [consequence].**

</critical_reminders>
````

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
**Category exclusive:** [true/false] - [reasoning]
</skill_relationships>

<validation>
## Skill Quality Checks

**PROMPT_BIBLE Compliance:**
- [ ] Has `<critical_requirements>` section at TOP
- [ ] Has `<critical_reminders>` section at BOTTOM
- [ ] Critical rules use `**(You MUST ...)**` format
- [ ] Major sections wrapped in semantic XML tags
- [ ] Has `---` horizontal rules between major patterns

**Structure:**
- [ ] Has Quick Guide summary at top
- [ ] Has Auto-detection keywords
- [ ] Has `<philosophy>` section
- [ ] Has `<patterns>` section with good/bad examples
- [ ] Has `<decision_framework>` section
- [ ] Has `<red_flags>` section with Gotchas subsection

**Quality:**
- [ ] All code examples are syntactically correct
- [ ] Examples follow the patterns described (no contradictions)
- [ ] Usage guidance is specific (not vague "use when needed")
- [ ] Tags are lowercase kebab-case
- [ ] Author handle starts with @
- [ ] cli_description is 5-6 words max
</validation>
</output_format>
