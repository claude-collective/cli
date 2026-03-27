---
type: anti-pattern
severity: medium
affected_files:
  - /home/vince/dev/skills/src/skills/web-ui-chakra-ui/SKILL.md
  - /home/vince/dev/skills/src/skills/web-ui-chakra-ui/reference.md
  - /home/vince/dev/skills/src/skills/web-ui-mantine/SKILL.md
  - /home/vince/dev/skills/src/skills/web-ui-ant-design/SKILL.md
  - /home/vince/dev/skills/src/skills/web-ui-shadcn-ui/SKILL.md
  - /home/vince/dev/skills/src/skills/web-ui-headless-ui/examples/headless-ui.md
  - /home/vince/dev/skills/src/skills/web-ui-ant-design/examples/ant-design.md
standards_docs:
  - .ai-docs/standards/skill-atomicity-bible.md
date: 2026-03-27
reporting_agent: skill-summoner
category: architecture
domain: web
root_cause: convention-undocumented
---

## What Was Wrong

UI component library skills (Chakra UI, Mantine, Ant Design, shadcn/ui) named competing libraries by name in "When NOT to use" sections and decision trees. Per the atomicity bible, skills must not include "tool names from other skills anywhere in text." Examples:

- Chakra UI: "Projects already using another component library (MUI, Ant Design, shadcn/ui)"
- Mantine: "Projects committed to a different component library (MUI, Chakra, shadcn/ui)"
- Ant Design: "use Radix UI or headless primitives"
- shadcn/ui: "Material, Ant Design"

Additionally, two redirect stub files existed (headless-ui.md, ant-design.md) that should have been deleted per the atomicity bible: "Old monolithic example files should be deleted once content is moved to core.md + topic files -- do not leave redirect stubs."

## Fix Applied

1. Genericized all "When NOT to use" entries to remove competitor names:
   - "Projects already using another component library" (no names)
   - "utility-class-first styling" instead of naming Tailwind
   - "headless primitives" instead of naming Radix UI
   - "opinionated design system" without naming specific ones
2. Genericized Chakra UI reference.md decision tree to remove shadcn/ui, Tailwind, Radix references
3. Deleted redirect stub files: headless-ui.md and ant-design.md

## Proposed Standard

Document explicitly in the atomicity bible that "When NOT to use" sections are NOT exempt from the atomicity rule. Competing library names should be genericized to architectural categories (e.g., "utility-class-first library", "headless primitives", "opinionated design system"). This is a common pattern across UI library skills that will recur if not explicitly called out.
