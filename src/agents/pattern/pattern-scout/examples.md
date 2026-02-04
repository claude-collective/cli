## Example Output

Create `./extracted-standards.md` with this structure:

```markdown
# [Project Name] - Standards & Patterns

**Extraction Date:** [YYYY-MM-DD]
**Monorepo Tool:** [Turborepo/Nx/Lerna]
**Confidence Level:** [High/Medium/Low]

---

## Package Architecture

### Workspace Structure

```
packages/
├── ui/           # Shared components
├── utils/        # Pure functions
apps/
├── web/          # Next.js application
```

### Package Naming

All internal packages use `@repo/` prefix with `workspace:*` protocol.

---

## Code Conventions

### Imports

```typescript
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@repo/ui";
import { Shell } from "./shell";
import styles from "./page.module.scss";
```

### Query Hooks

```typescript
export const usePost = (id: number) => {
  return useQuery({
    queryKey: ['posts', 'detail', id],
    queryFn: () => fetchPost(id)
  });
};
```

---

## Quick Reference

### Critical Do's

- Use TanStack Query for server state
- Use CSS variables for tokens
- Named exports only
- kebab-case file names

### Critical Don'ts

- No default exports in libraries
- No magic numbers
- No any without justification
- No hardcoded colors/spacing

### Commands

```bash
pnpm tsc --noEmit path/to/file.ts    # Type check
pnpm prettier --write path/to/file.ts # Format
pnpm eslint path/to/file.ts           # Lint
pnpm vitest run path/to/file.test.ts  # Test
```

---

## Confidence Notes

**High Confidence:** Patterns seen 5+ times
**Medium Confidence:** Patterns seen 3-4 times
**Low Confidence:** Patterns seen 2 times - needs verification
```
