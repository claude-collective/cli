## Example: Complete Skill Package

### Directory Structure

```
.claude/skills/web-state-mobx/
├── SKILL.md
├── metadata.yaml
└── examples/async-actions.md (optional)
```

### metadata.yaml

```yaml
category: web-state
author: "@skill-summoner"
version: 1
cli_name: MobX State
cli_description: Observable state management patterns
usage_guidance: >-
  Use when implementing client-side state with MobX observables,
  computed values, or reactions. Not for server state (use React Query).
requires: []
compatible_with: [web-framework-react]
conflicts_with: [web-state-redux-toolkit]
tags: [state-management, observables]
```

### SKILL.md (condensed)

```markdown
# MobX State Management Patterns

> **Quick Guide:** Use MobX for complex client state needing computed values and automatic dependency tracking.

<critical_requirements>

## ⚠️ CRITICAL: Before Using This Skill

> **All code must follow project conventions in CLAUDE.md**

**(You MUST call `makeAutoObservable(this)` in EVERY store constructor)**
**(You MUST wrap ALL async state updates in `runInAction()`)**
**(You MUST use React Query for server state - NOT MobX)**
</critical_requirements>

<philosophy>
## Philosophy
MobX: "anything that can be derived, should be derived automatically."
**When to use:** Complex client state, computed values, class-based architecture
**When NOT to use:** Server state (React Query), simple UI state (useState/Zustand)
</philosophy>

<patterns>
## Core Patterns

### Pattern 1: Store with makeAutoObservable

​`typescript
// ✅ Good Example
const ACTIVE_STATUS = "active";
class UserStore {
  users: User[] = [];
  constructor() { makeAutoObservable(this); }
  get activeUsers() { return this.users.filter((u) => u.status === ACTIVE_STATUS); }
}
export { UserStore };
​`
**Why good:** makeAutoObservable enables tracking, named constants, named exports

​`typescript
// ❌ Bad Example
class UserStore {
  users = [];
  async fetchUsers() {
    const response = await apiClient.getUsers();
    this.users = response.data; // BAD: Outside action after await
  }
}
export default UserStore; // BAD: Default export
​`
**Why bad:** State mutation after await breaks reactivity, default export violates conventions
</patterns>

<red_flags>

## RED FLAGS

- ❌ Mutating observables outside actions (breaks reactivity)
- ❌ Using MobX for server state (use React Query)
- ⚠️ Not using `observer()` HOC on React components
  **Gotchas:** Code after `await` is NOT part of the action - wrap in `runInAction()`
  </red_flags>

<critical_reminders>

## ⚠️ CRITICAL REMINDERS

**(You MUST call `makeAutoObservable(this)` in EVERY store constructor)**
**(You MUST wrap ALL async state updates in `runInAction()`)**
**(You MUST use React Query for server state - NOT MobX)**
**Failure to follow these rules will break MobX reactivity.**
</critical_reminders>
```

---

## Common Mistakes

| Mistake            | Wrong                | Correct                               |
| ------------------ | -------------------- | ------------------------------------- |
| Directory location | `src/skills/mobx.md` | `.claude/skills/web-state-mobx/`      |
| Naming pattern     | `mobx`, `state-mobx` | `web-state-mobx`                      |
| File structure     | Single file          | Directory + SKILL.md + metadata.yaml  |
| Auto-detection     | "state management"   | "MobX observable, makeAutoObservable" |
| Examples           | Separate section     | Embedded in each pattern              |
