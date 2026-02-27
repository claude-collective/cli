# PR: Pre-1.0 Cleanup

Bundled cleanup tasks to simplify the codebase before 1.0.

## Tasks

| ID    | Task                                                           | Source   | Effort  |
| ----- | -------------------------------------------------------------- | -------- | ------- |
| D-53  | Rename `agent.yaml` to `metadata.yaml`                         | TODO     | Medium  |
| D-60  | Remove `cli-migrator` subagent                                 | TODO     | Small   |
| D-54  | Remove expert mode: make it the default behaviour              | TODO     | Small   |
| D-44  | Update docs for `eject templates` type                         | TODO     | Small   |
| D-28  | Fix startup warning/error messages (Ink clears)                | Deferred | Medium  |
| D-20  | Add Edit tool to documentor agent                              | Deferred | Trivial |
| D-05  | Dashboard when `init` run on existing project                  | Deferred | Small   |
| D-59  | Unified scrolling across all wizard views                      | TODO     | Medium  |
| D-36  | Global install support with project-level override             | TODO     | Large   |
| D-61  | Preserve stack skill selections when toggling domains          | TODO     | Small   |
| B-07  | Fix skill sort order changing on select/deselect in build step | New      | Small   |
| WUX-3 | Visually verify wizard UX changes                              | Final    | Manual  |

## Notes

- D-53: biggest task (~52 files) but purely mechanical rename
- D-60: clean deletion of agent definition files + README table
- D-54: remove the toggle, make expert mode the default; ripples into help overlay and config
- D-44: docs-only; replace `--templates` flag references with `agentsinc eject templates`
- D-28: buffer pre-Ink messages, render via `<Static>` so they survive Ink's clearTerminal. Refined with clear fix path
- D-20: one-line tool addition to documentor agent definition
- D-05: ~40 lines in `init.tsx`; show summary dashboard + suggest next steps instead of terse warning. Reuses existing `loadProjectConfig()`
- D-59: replicate existing scroll pattern (`useMeasuredHeight` + pixel offset) to `step-stack.tsx`, `step-settings.tsx`, `checkbox-grid.tsx`. Pattern already in 3 views
- D-36: `--global` flag on `init`; global installs to `~/.claude-src/`, `~/.claude/skills/`, `~/.claude/agents/`. Project-level falls back to global when no local config. Phase 1 only (full override, no merging — D-37 handles merging later)
- WUX-3: manual verification pass after D-54 and D-59 land (no code, just run the wizard and check)
- D-61: re-select a domain → restore stack's preset skill selections instead of returning empty
- B-07: selecting/deselecting skills in the build step changes the sort order of skills in the grid. Sort should be stable regardless of selection state
- D-36 is the largest task but well-scoped (phase 1 only, no merge logic)
- D-61 and B-07 are related — both involve skill state in the build step after toggling
