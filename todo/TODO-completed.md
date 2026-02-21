# Agents Inc. CLI - Completed Tasks

> Completed tasks from [TODO.md](./TODO.md) are archived here to keep the main file lean.

- **D-16**: Populate config defaults on `init` -- Added commented-out `source`, `marketplace`, and `agents_source` options to generated config.yaml.
- **R-1**: Consolidate agent-skill mappings into YAML -- Demoted `SKILL_TO_AGENTS` and `AGENT_SKILL_PREFIXES` to private fallbacks; YAML is now the primary source via `getCachedDefaults()`. Tests updated to verify YAML-loaded values.
- **U-STACK-DESC**: Shorten default stack descriptions -- All stack descriptions in `config/stacks.yaml` shortened to 3-5 words.
- **U-SOURCES-SEARCH-FOCUS**: Auto-focus search field in sources step -- Used Ink `isActive` on `useInput` to properly route keyboard input to search modal when open, deactivating grid input.
- **Wizard-UX #2**: Marketplace label always renders -- Label now always shows in wizard header, defaulting to "agents-inc (public)" when no custom marketplace is configured.
- **B-1**: Fix `preloaded` dropped from stack skills -- Overlay preloaded flags from `buildStackProperty(loadedStack)` onto config in `buildLocalConfig()` after `generateProjectConfigFromSkills` call.
- **#9**: Divide hackathon tasks among team -- Planned and organized task distribution for the hackathon with parallel workstreams.
- **#10**: Create work-level marketplace repo -- Coordinated with team to create the marketplace repository.
- **U-UNINSTALL-SCOPE**: Uninstall removes only CLI-owned files -- Added `generatedByAgentsInc` flag to metadata during install/eject; uninstall now surgically removes only CLI-created skills and agents.
- **U-EXPERT-MODE-PERSIST**: Persist expertMode to config YAML -- Added `expertMode` field to ProjectConfig, schemas, local-installer, wizard props (7 files, follows installMode pattern).
- **U-METADATA-REQUIRED**: Require metadata.yaml for all custom skills -- Updated compile's `loadSkillsFromDir()` to require metadata.yaml; emits `warn()` when missing.
- **Wizard-UX session**: Remove branding from tab bar, suppress marketplace.json warning, replace fixed `AVG_TAG_WIDTH` with actual calculation, remove state icons from tags, dim default borders with state-colored on hover, stable skill ordering, hotkey badge highlights teal when active, domain selection spacebar/ESC, legend filled circle for active, build step max height + natural scroll.
- **T5**: Create work-related agents and skills -- Identified gaps, created specialized agents and skills for work patterns.
- **U-SOURCES-SCROLL**: Add scrolling to Sources step -- Replicated Build step's pixel-accurate scroll pattern in SourceGrid with `useMeasuredHeight` hook and retry measurement strategy [0, 16, 50ms].
- **UX-14**: Build step compatibility labels toggle -- Replaced "descriptions" toggle with compatibility labels toggle showing "(Selected)", "(Recommended)", "(Discouraged)", "(Disabled)" on skill tags via `d` key.
- **D-30**: Add Agents selection step to wizard -- Added new "Agents" wizard step with grouped checkbox layout. Agents pre-selected based on selected domains using `agentSkillPrefixes` from agent-mappings.yaml.
- **D-35**: Pre-D-31 cleanup: merge meta-framework + remove web-extras -- Merged `meta-framework` into `framework`, removed `web-extras` domain/parentDomain plumbing, simplified agent preselection logic.
- **D-27**: Switch config/metadata fields from snake_case to camelCase -- Renamed all 27 snake_case fields to camelCase across YAML configs, TypeScript types, Zod schemas, JSON schemas, and all property accesses.
- **D-29**: Ensure skills metadata YAML includes $schema reference -- All 87 metadata.yaml files in the source marketplace now include `$schema` references.
- **D-31**: Prefix categories with their domain -- Subcategory keys now use domain-prefixed format (e.g., `web-framework`, `api-testing`) across skills matrix, stacks, metadata, schemas, and TypeScript types.
- **D-32**: Add category as enum in metadata JSON schema -- Changed `metadataValidationSchema` category field from `z.string()` to `subcategorySchema`, regenerated `metadata.schema.json` with 37-value enum.
- **D-38**: Remove `version` command group -- Deleted version commands (show, bump, set), core logic (`plugin-version.ts`), and all tests. Redundant with build plugins auto-versioning.
- **D-39**: Remove `version` integer field from metadata.yaml schema -- Removed from schemas, types, loaders, UI, and test fixtures. Was parsed but silently dropped; actual versioning lives in plugin.json.
- **B-01**: Edit wizard shows steps that were omitted during init -- Domains persisted to config during init; edit mode restores `initialDomains` to wizard, filtering build steps to only selected domains.
