---
type: anti-pattern
severity: high
affected_files:
  - /home/vince/dev/skills/src/skills/cli-framework-oclif-ink/SKILL.md
  - /home/vince/dev/skills/src/skills/cli-framework-oclif-ink/examples/core.md
  - /home/vince/dev/skills/src/skills/cli-framework-oclif-ink/examples/advanced.md
standards_docs:
  - .ai-docs/standards/skill-atomicity-bible.md
  - .ai-docs/standards/skill-atomicity-primer.md
date: 2026-03-27
reporting_agent: skill-summoner
category: architecture
domain: cli
root_cause: convention-undocumented
---

## What Was Wrong

The `cli-framework-oclif-ink` skill had four API accuracy issues and one atomicity violation:

1. **Fabricated API (`usePaste`)**: SKILL.md referenced `usePaste` as an Ink hook for paste handling. Ink does not export any `usePaste` hook -- this was a hallucinated API from the original AI generation.

2. **Wrong `ConfirmInput` props** (examples/core.md): Used `onConfirm` and `onCancel` callback props. In @inkjs/ui, `ConfirmInput` uses `onSubmit: (value: boolean) => void` -- there is no `onCancel` prop.

3. **Wrong `MultiSelect` callback** (examples/advanced.md): Used `onChange` instead of `onSubmit`. In @inkjs/ui, `MultiSelect` fires `onSubmit` with the selected values when the user confirms selection.

4. **Inaccurate version claim**: Stated "Ink v6 requires React 19+" -- Ink v6 is not a released version. Only Ink v5 (React 18+) exists as a stable release.

5. **Atomicity violation (Category 2)**: Named `@clack/prompts` and `inquirer` as specific tool alternatives in the "When NOT to use" section.

## Fix Applied

- Replaced `usePaste` reference with generic guidance: "handle multi-character input strings explicitly"
- Changed `ConfirmInput` to use `onSubmit((confirmed) => { ... })` pattern
- Changed `MultiSelect` from `onChange` to `onSubmit`
- Removed Ink v6 claim, kept only accurate "Ink v5 requires React 18+"
- Genericized tool recommendation to "a lightweight prompt library suffices"

## Proposed Standard

AI-generated skills commonly contain hallucinated APIs and wrong callback prop names for component libraries. The skill-atomicity-primer.md already warns about "Wrong API signatures" but could be strengthened with:

- **In `skill-atomicity-primer.md` "API verification" section**: Add guidance to specifically verify callback/event handler prop names (onSubmit vs onChange vs onConfirm) since these are the most commonly hallucinated details in component-based libraries.
