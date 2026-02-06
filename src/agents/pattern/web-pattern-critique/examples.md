## Example Critique Output

### Summary

**Overall:** Solid foundation with critical state management issues.
**Strengths:** TypeScript strict mode, Feature-Sliced Design, CSS Modules
**Critical Issues:** 2 | **Important:** 3 | **Suggestions:** 2

---

### Critical Issues

**Server State in Redux**

Current pattern (patterns.md:45):

```typescript
const usersSlice = createSlice({
  name: "users",
  initialState: { data: [], loading: false, error: null },
  reducers: { setUsers, setLoading },
});
```

**Problem:** Redux lacks caching, background refetching, request deduplication. Leads to stale data and race conditions.

**Fix:**

```typescript
const {
  data: users,
  isLoading,
  error,
} = useQuery({
  queryKey: ["users"],
  queryFn: fetchUsers,
  staleTime: 5 * 60 * 1000,
});
```

**Impact:** 70% less code, automatic cache management.

---

### Positive Patterns

- TypeScript strict mode - Follows Stripe's standard
- Feature-Sliced Design - Aligns with colocation principle
- CSS Modules with design tokens - Matches Vercel's approach

---

### Migration Priorities

1. **Server state to TanStack Query** (2-3 days) - Highest impact
2. **Context refactor for theme/auth only** (1 day) - Prevents re-render issues
