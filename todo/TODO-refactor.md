# Agents Inc. CLI - Refactoring Tasks

> Refactoring tasks from [TODO.md](./TODO.md) are tracked here separately.

| ID   | Task                                                                                                              | Status   |
| ---- | ----------------------------------------------------------------------------------------------------------------- | -------- |
| R-06 | Slim down `ResolvedSkill` — separate resolved relationship data from skill identity/metadata to reduce type bloat | Refactor |

---

## R-06: Slim Down `ResolvedSkill`

**Priority:** Low
**Status:** Refactor
**Depends on:** R-04

### Problem

`ResolvedSkill` is a bloated type that mixes skill identity/metadata with resolved relationship data. Every skill carries its own copies of `compatibleWith`, `conflictsWith`, `requires`, `recommends`, `requiresSetup`, `providesSetupFor`, `discourages`, `alternatives` — arrays of skill IDs that are computed from centralized relationship rules and then duplicated onto every individual skill object.

After R-04 adds `isRecommended`, `slug`, and keeps `displayName`, the type grows further. The relationship arrays are not intrinsic to the skill — they're computed views of centralized data that happen to be denormalized onto each skill for convenience.

### Proposed solution

Separate `ResolvedSkill` into two concerns:

1. **Skill identity** — intrinsic properties: `id`, `displayName`, `slug`, `category`, `domain`, `tags`, `description`, `author`, `isRecommended`, `source`, `installed`, etc.
2. **Resolved relationships** — computed from centralized rules, stored separately (e.g., on the matrix or in a parallel lookup): `compatibleWith`, `conflictsWith`, `requires`, `requiresSetup`, `providesSetupFor`, `discourages`, `alternatives`.

Consumers that need relationship data would look it up from the relationship index rather than reading it off the skill object. The wizard resolver already computes these from centralized rules — the question is whether to store them per-skill or in a separate structure.

### Investigation needed

- Audit all consumers of `ResolvedSkill` relationship fields — how many actually need them on the skill object vs could use a lookup?
- Determine the right shape for the separated relationship data (parallel map? method on a resolver class? computed on demand?)
- Evaluate whether this is worth the churn or if the denormalized model is acceptable long-term

---
