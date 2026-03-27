---
type: anti-pattern
severity: medium
affected_files:
  - /home/vince/dev/skills/src/skills/mobile-framework-react-native/SKILL.md
  - /home/vince/dev/skills/src/skills/mobile-framework-react-native/reference.md
  - /home/vince/dev/skills/src/skills/mobile-framework-react-native/examples/core.md
  - /home/vince/dev/skills/src/skills/mobile-framework-expo/reference.md
standards_docs:
  - .ai-docs/standards/skill-atomicity-bible.md
date: 2026-03-27
reporting_agent: skill-summoner
category: architecture
domain: shared
root_cause: convention-undocumented
---

## What Was Wrong

Two cross-domain anti-patterns found in the mobile skills:

1. **React Native skill contained Expo-specific content**: The RN skill had an `import * as Haptics from "expo-haptics"` (Category 1: Import Coupling), an "Expo vs Bare Workflow" decision tree (duplicating the Expo skill), Expo CLI commands, and "Use Expo for most projects" explicit tool recommendation (Category 2). The SKILL.md description and auto-detection keywords also included Expo-specific terms.

2. **Expo skill had duplicated RED FLAGS**: The reference.md had a full "RED FLAGS" section that duplicated SKILL.md's `<red_flags>` content verbatim, violating the "each concept lives in ONE canonical location" rule from the atomicity bible.

## Fix Applied

**React Native skill:**

- Replaced `import * as Haptics from "expo-haptics"` with generic haptic feedback comments
- Removed "Expo vs Bare Workflow" decision tree from reference.md
- Removed Expo CLI commands section, kept only bare React Native CLI commands
- Genericized "Expo Router" reference to "file-based routing / managed workflow's router"
- Removed "Use Expo for most projects" from Quick Guide
- Removed "Expo SDK 53+" from SKILL.md description and auto-detection
- Genericized Expo SDK reference in red flags

**Expo skill:**

- Removed duplicated RED FLAGS section from reference.md (keeping unique gotchas in a new "SDK Gotchas and Edge Cases" section)
- Anti-patterns with code examples remain in reference.md (their canonical location)

## Proposed Standard

The atomicity bible already covers this (Category 1: Import Coupling, Category 2: Explicit Tool Recommendations). The specific gap is that **sibling skills in the same domain** (mobile-framework-expo and mobile-framework-react-native) are especially prone to cross-contamination because their domains overlap. Consider adding a note to the atomicity bible: "Skills in the same category must be especially careful about cross-references. React Native is the platform; Expo is the managed workflow. Each skill should only discuss its own scope."
