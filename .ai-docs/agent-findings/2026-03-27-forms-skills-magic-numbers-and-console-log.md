---
type: anti-pattern
severity: medium
affected_files:
  - /home/vince/dev/skills/src/skills/web-forms-vee-validate/examples/validation.md
  - /home/vince/dev/skills/src/skills/web-forms-vee-validate/examples/core.md
  - /home/vince/dev/skills/src/skills/web-forms-vee-validate/examples/arrays.md
  - /home/vince/dev/skills/src/skills/web-forms-zod-validation/SKILL.md
  - /home/vince/dev/skills/src/skills/web-forms-zod-validation/examples/core.md
  - /home/vince/dev/skills/src/skills/web-forms-zod-validation/examples/advanced-patterns.md
standards_docs:
  - .ai-docs/standards/skill-atomicity-bible.md
  - .ai-docs/standards/skill-atomicity-primer.md
date: 2026-03-27
reporting_agent: skill-summoner
category: dry
domain: web
root_cause: enforcement-gap
---

## What Was Wrong

Three issues found across the web-forms skills:

1. **Magic numbers in validation schemas** (7 instances across Zod and VeeValidate skills): `.min(18)`, `.min(10)`, `.max(1000)`, `.max(200)`, `.min(2024)`, `.max(500)`, `.max(100)`, `.min(8)`, `.default(1)`, `.default(20)` appeared without named constants. The Zod skill's own critical requirements explicitly state "NO magic numbers in .min(), .max(), .length()" and this was flagged as a RED FLAG within the same skill that violated it.

2. **console.log as submit handler** (7 instances in VeeValidate examples): Example submit handlers used `console.log(values)` instead of proper placeholder functions like `await submitForm(values)`. The React Hook Form skill correctly used `await loginUser(data)`, `await createInvoice(data)` etc. for the same purpose.

3. **Cross-domain framework reference** (1 instance in VeeValidate arrays.md): "React-like correct reconciliation" appeared in a Vue library's skill, referencing React by name in a VeeValidate context.

## Fix Applied

All three issues fixed:

- Extracted 10 named constants (MIN_AGE, MIN_CONTENT_LENGTH, MIN_MESSAGE_LENGTH, MAX_MESSAGE_LENGTH, MAX_TITLE_LENGTH, MIN_EXPIRY_YEAR, MAX_NOTES_LENGTH, MAX_PAGE_SIZE, MIN_PASSWORD_LENGTH, DEFAULT_PAGE/DEFAULT_LIMIT/MAX_LIMIT)
- Replaced 7 console.log calls with async placeholder functions (submitForm, updatePassword, saveContacts, saveTasks, placeOrder)
- Changed "React-like correct reconciliation" to "correct DOM reconciliation"

## Proposed Standard

Add to skill-atomicity-primer.md under "Learnings from Iteration":

- **console.log in examples**: Replace with descriptive placeholder function calls (`await submitForm(values)`, not `console.log(values)`). Examples teach patterns -- console.log teaches debugging, not production code.
- **Self-contradicting skills**: When a skill's critical requirements forbid magic numbers, grep the skill's own examples for violations before considering the skill complete.
