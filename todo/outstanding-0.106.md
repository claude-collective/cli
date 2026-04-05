# Outstanding Changes & Known Issues (post-0.106.0)

## Known Broken (it.fails E2E tests)

### Stale agent file after scope toggle

- **Test:** `dual-scope-edit-scope-changes` — agent toggle
- **Issue:** Toggling a project agent to global scope compiles it to `~/.claude/agents/` correctly, but the old `.md` file lingers in `<project>/.claude/agents/`. No cleanup of the previous scope directory.
- **Related:** D-178 (ENOENT in project-scoped skill copy)

### ENOENT in project-scoped skill copy

- **Test:** `dual-scope-edit-scope-changes` — skill toggle
- **Issue:** Toggling a project skill to global scope fails with ENOENT during skill copy. Pre-existing issue (D-178).

## Functionality Not Yet Done

### ~~D-184: Sources step scope sections~~ ✓ DONE

- Scope labels ("Global" / "Project") now render as an inline left column in the source grid
- First row of each group shows the label; subsequent rows have an empty spacer

### ~~D-187: Disable scope toggle in global context~~ ✓ DONE

- S key shows toast "Scope toggle unavailable in global context" when `isEditingFromGlobalScope` is true
- Applies to both build step (skill scope) and agents step (agent scope)
- `init.tsx` computes `isGlobalRoot` and passes it through as `isEditingFromGlobalScope`

### D-182: Confirm step scope change indicator

- When a skill/agent changes scope (global to project or vice versa), confirm step shows it as separate add/remove instead of a `~` scope change indicator
- Pre-existing issue, partially improved (inherited globals now shown)

## Not Manually Verified

- `propagateGlobalChangesToProjects` (D-183) — E2E tests pass but cross-project propagation not manually tested after editing global skills from a project context
- `deregisterProjectPath` on `uninstall --all` — E2E test passes but not manually tested
