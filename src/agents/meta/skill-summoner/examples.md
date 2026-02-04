## Example: Complete Skill Structure

**File: `mobx.md`**

```markdown
# MobX State Management Patterns

> **Quick Guide:** Use MobX for complex client state needing computed values and automatic dependency tracking.

---

## CRITICAL: Before Using This Skill

> **All code must follow project conventions in CLAUDE.md**

**(You MUST call `makeAutoObservable(this)` in EVERY store constructor)**

**(You MUST wrap ALL async state updates in `runInAction()`)**

**(You MUST use React Query for server state - NOT MobX)**

---

**Auto-detection:** MobX observable, makeAutoObservable, runInAction

**When to use:**

- Managing complex client state with computed values
- Building stores with automatic dependency tracking
- Class-based state management (OOP approach)

---

## Philosophy

MobX follows "anything derivable from state should be derived automatically." Uses observables and reactions for automatic dependency tracking.

**When NOT to use:**

- Server state (use React Query)
- Simple UI state (use Zustand or useState)

---

## Core Patterns

### Store with makeAutoObservable

```typescript
import { makeAutoObservable, runInAction } from "mobx";

const ACTIVE_STATUS = "active";

class UserStore {
  users: User[] = [];
  isLoading = false;

  constructor() {
    makeAutoObservable(this);
  }

  get activeUsers() {
    return this.users.filter((u) => u.status === ACTIVE_STATUS);
  }

  async fetchUsers() {
    this.isLoading = true;
    try {
      const response = await apiClient.getUsers();
      runInAction(() => {
        this.users = response.data;
        this.isLoading = false;
      });
    } catch (err) {
      runInAction(() => {
        this.isLoading = false;
      });
    }
  }
}

export { UserStore };
```

**Why:** makeAutoObservable enables automatic tracking, runInAction prevents warnings after await

---

## Decision Framework

```
Need client state management?
├─ Is it server/remote data?
│   └─ YES → React Query (not MobX)
└─ NO → Do you need computed values?
    ├─ YES → MobX
    └─ NO → Zustand (simpler)
```

---

## RED FLAGS

- Mutating observables outside actions (breaks reactivity)
- Not using runInAction for async updates
- Using MobX for server state

**Gotchas:**

- Code after `await` is NOT part of the action
- Destructuring observables breaks reactivity

---

## CRITICAL REMINDERS

**(You MUST call `makeAutoObservable(this)` in EVERY store constructor)**

**(You MUST wrap ALL async state updates in `runInAction()`)**

**(You MUST use React Query for server state - NOT MobX)**

**Failure to follow these rules will break MobX reactivity.**
```

Key elements shown:

- Single file with all content
- Critical requirements at TOP, reminders at BOTTOM
- References CLAUDE.md for generic conventions
- Domain-specific rules only
- Good/bad examples within patterns
- Decision framework for when to use
