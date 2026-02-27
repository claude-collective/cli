# Documentation Map

**Last Updated:** 2026-02-25
**Total Areas:** 12
**Documented:** 12 (100%)
**Needs Validation:** 0
**Last Validated:** 2026-02-25 (adversarial audit -- all files verified against source)

## Status Legend

- [DONE] Complete and validated
- [NEEDS-VALIDATION] Documented but needs validation
- [IN-PROGRESS] In progress
- [PLANNED] Planned
- [NOT-STARTED] Not started

## Documentation Status

| Area                  | Status | File                               | Last Updated | Last Validated | Next Action         |
| --------------------- | ------ | ---------------------------------- | ------------ | -------------- | ------------------- |
| Architecture Overview | [DONE] | `architecture-overview.md`         | 2026-02-25   | 2026-02-25     | Validate in 30 days |
| Commands Reference    | [DONE] | `commands.md`                      | 2026-02-25   | 2026-02-25     | Validate in 14 days |
| Type System           | [DONE] | `type-system.md`                   | 2026-02-25   | 2026-02-25     | Validate in 14 days |
| State Management      | [DONE] | `store-map.md`                     | 2026-02-25   | 2026-02-25     | Validate in 7 days  |
| Compilation Pipeline  | [DONE] | `features/compilation-pipeline.md` | 2026-02-25   | 2026-02-25     | Validate in 14 days |
| Configuration System  | [DONE] | `features/configuration.md`        | 2026-02-25   | 2026-02-25     | Validate in 14 days |
| Wizard Flow           | [DONE] | `features/wizard-flow.md`          | 2026-02-25   | 2026-02-25     | Validate in 14 days |
| Skills & Matrix       | [DONE] | `features/skills-and-matrix.md`    | 2026-02-25   | 2026-02-25     | Validate in 14 days |
| Plugin System         | [DONE] | `features/plugin-system.md`        | 2026-02-25   | 2026-02-25     | Validate in 14 days |
| Component Patterns    | [DONE] | `component-patterns.md`            | 2026-02-25   | 2026-02-25     | Validate in 14 days |
| Utilities Reference   | [DONE] | `utilities.md`                     | 2026-02-25   | 2026-02-25     | Validate in 14 days |
| Test Infrastructure   | [DONE] | `test-infrastructure.md`           | 2026-02-25   | 2026-02-25     | Validate in 14 days |

## Coverage Metrics

**Source Files:** 253 TypeScript files in `src/cli/`
**All major systems documented:** Yes

**Technical Areas:**

- Architecture: [DONE]
- Commands: [DONE]
- Type System: [DONE]
- State Management: [DONE]
- Compilation Pipeline: [DONE]
- Configuration: [DONE]
- Wizard Flow: [DONE]
- Skills & Matrix: [DONE]
- Plugin System: [DONE]
- Component Patterns: [DONE]
- Utilities: [DONE]
- Test Infrastructure: [DONE]

## Validation History

### 2026-02-25 Adversarial Audit

Full validation of all 12 documentation files against actual source code. Errors found and fixed:

**type-system.md:**

- Fixed Subcategory count: 38 (was 46)
- Fixed SkillDisplayName count: 82 (was 118)
- Removed phantom "SkillRef" alias (does not exist; actual type is PluginSkillRef)
- Added missing types: CompileConfig, CompileContext, ValidationResult, ExtractedSkillMetadata
- Added wizard/UI types table from matrix.ts
- Added metadataValidationSchema to Zod schemas table

**utilities.md:**

- Fixed ERROR_MESSAGES count: 10 (was 8)
- Fixed STATUS_MESSAGES count: 12 (was 10)
- Fixed INFO_MESSAGES count: 7 (was 6)
- Added STANDARD_FILES and STANDARD_DIRS reference section

**features/plugin-system.md:**

- Fixed installLocal() location: local-installer.ts:511 (was installation.ts)
- Fixed installPluginConfig() location: local-installer.ts:435 (was installation.ts)
- Added re-export note from index.ts
- Added validatePlugin line reference (:359)
- Added dual getPluginManifestPath note

**test-infrastructure.md:**

- Added note that test/fixtures/ directory does NOT exist at project root
- Added KEY_Y and KEY_N to keyboard constants table
- Added delay() utility
- Added missing co-located test files (installation, plugin tests)

**component-patterns.md:**

- Fixed hooks count: 14 (was 15)
- Fixed wizard files count: 22 (was 20)
- Added DISABLED symbol to UI_SYMBOLS table
- Fixed CategoryOption type: uses `state: OptionState` pattern (not individual booleans)
- Added OptionState and CategoryRow types
- Updated consumers list (added build-step-logic.ts)

**commands.md:**

- Fixed installIndividualPlugins reference (private method on Init class, not from installation module)
- Fixed key dependencies (installation/index.ts, not installation.ts)
- Added message count references

**store-map.md:**

- Added 14 missing actions: setApproach, selectStack, setStackAction, nextDomain, prevDomain, toggleShowLabels, toggleExpertMode, toggleInstallMode, setSourceSelection, setCustomizeSources, toggleSettings, toggleHelp, setEnabledSources
- Reorganized actions into clear categories (Navigation, Approach/Stack, Selection, UI Toggles, Source Management, Population, Reset)

**features/skills-and-matrix.md:**

- Added missing `sourcePath: string` field to SourceLoadResult type
- Added line references to SourceLoadResult type definition
- Added line numbers for all matrix-resolver.ts functions
- Added undocumented utility functions: getAvailableSkills, getSkillsByCategory

## Notes for Next Session

- Validate store-map.md first (most likely to drift due to active wizard development)
- Check for new commands added since last documentation
- Verify type system doc against types/ for any new union members
- Check if AgentName union has grown (currently 18 members)
