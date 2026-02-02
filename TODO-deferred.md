# Claude Collective CLI - Deferred Tasks

> This file contains deferred tasks moved from [TODO.md](./TODO.md) to keep the main file lean.
> These tasks are not blocked but have been deprioritized for future implementation.

---

## Phase 6 Future Work

**M | D-08 | Support user-defined stacks in consumer projects**
Allow consumers to define custom stacks in their own `config/stacks.yaml` file. The stack loader should merge user stacks with CLI built-in stacks, with user stacks taking precedence (following the pattern used for agent loading in `stack-plugin-compiler.ts:301-308`). Currently only CLI built-in stacks from `/home/vince/dev/cli/config/stacks.yaml` are supported.

**M | D-09 | Fix agent-recompiler tests for Phase 6**
7 tests in `src/cli-v2/lib/agent-recompiler.test.ts` are skipped because agents now have skills in their YAMLs (Phase 6). Tests need to either provide the skills that agents reference, use test agents without skills, or bypass skill resolution.
**Note:** Phase 7 will remove skills from agent YAMLs entirely (P7-0-1). This task may become obsolete.

---

## Phase 3 Deferred

**L | P3-14 | Individual skill plugin installation**
Plugin mode only supports stacks. Would need to support installing individual skills as plugins.

---

## Phase 4 Deferred

**S | P4-16 | Test: All tests use shared fixtures**
Depends on P4-15. Consolidate test fixtures for consistency.

**M | P4-17 | Feature: `cc new skill/agent` supports multiple items**
Deferred until after migration. Allow creating multiple skills/agents in one command.

**S | P4-18 | Test: Multiple skill/agent creation works**
Depends on P4-17. Test coverage for multi-item creation.

---

## Phase 5 Deferred

**M | P5-6-4 | Cross-platform terminal testing** DEFERRED (depends: P5-4-12)
Test on macOS, Linux, Windows terminals, and CI environments

**S | P5-6-5 | Performance validation (<300ms startup)** DEFERRED (depends: P5-5-6)
Measure and validate startup time is within acceptable range

---

## General Deferred Tasks

**M | D-01 | Update skill documentation conventions**
Replace `examples-*.md` files with folder structure. Split examples vs patterns. Namespace files (e.g., `examples/core.md`, `patterns/testing.md`). Update `docs/skill-extraction-criteria.md` accordingly.

**M | D-02 | Fix skill ID mismatch between local and marketplace**
Local skills use short IDs (e.g., `cli-commander (@vince)`) while marketplace skills use full paths (e.g., `cli/framework/cli-commander (@vince)`). This causes `preloaded_skills` in agent.yaml to fail resolution during compile. Either normalize IDs during installation or support both formats in the resolver.

**M | D-04 | Create missing skills referenced in stack configs**
The following skills are referenced in stack configs but don't exist in the marketplace:

- `web/styling/tailwind (@vince)` - referenced by: nuxt-stack, remix-stack, solidjs-stack, vue-stack

These stacks will fail to build until the missing skills are created.

**S | D-05 | Improve `cc init` behavior when already initialized**
Currently, running `cc init` a second time just warns "already initialized" and suggests `cc edit`. This is not discoverable.

**Suggested approach:** When `cc init` detects an existing installation, show a "home screen" menu instead of just warning. Options could include:

- Reconfigure installation (change mode, stack, skills)
- Add/remove skills
- View current configuration
- Recompile agents
- Uninstall

This follows the pattern of CLIs like `npm init` (asks about overwriting) and provides better discoverability of available actions. The current behavior requires users to know about `cc edit`, `cc compile`, etc.

**S | D-06 | Fix require() syntax in matrix-resolver.test.ts**
4 tests in `src/cli-v2/lib/matrix-resolver.test.ts` use CommonJS `require('./matrix-resolver')` which fails with ESM modules. Convert to proper ESM imports or use dynamic `import()`.

**M | D-07 | Use full skill path as folder name when compiling**
When skills are copied locally, use the full path as the folder name instead of the short name. For example, `react (@vince)` should become `web/framework/react (@vince)`. This provides better organization and avoids potential naming conflicts between skills with the same short name in different categories.
