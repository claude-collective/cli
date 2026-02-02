# Skill ID Normalization Plan

## Overview

Normalize skill IDs from path-based format with author to simple kebab-case format.

**Current format:**
- Skill IDs: `web/framework/react (@vince)` or `react (@vince)`
- Output folders: `react (@vince)` or just `react`
- Aliases: `react` → `react (@vince)`

**Desired format:**
- Skill IDs: `web-framework-react` (kebab-case, no author, no slashes)
- Output folders: `web-framework-react`
- Author becomes metadata only (already exists in `metadata.yaml`)

---

## Files That Need Changes

### Critical (Must Change)

| File | Change Required |
|------|-----------------|
| `src/cli-v2/lib/matrix-loader.ts` | Add normalization to `extractAllSkills()` at line 134 |
| `src/cli-v2/lib/local-skill-loader.ts` | Add normalization to `extractLocalSkill()` at line 94 |
| `config/skills-matrix.yaml` | Update all `skill_aliases` values (~150 entries) |
| `src/cli-v2/consts.ts` | Update `DEFAULT_PRESELECTED_SKILLS` array (6 entries) |
| `src/cli-v2/lib/skill-copier.ts` | Simplify `getFlattenedSkillDestPath()`, remove `extractSkillNameFromId()` |

### High Priority

| File | Change Required |
|------|-----------------|
| NEW: `src/cli-v2/lib/skill-id-normalizer.ts` | Create normalization utility function |
| `src/cli-v2/types-matrix.ts` | Update JSDoc comments for ID format |
| Skill directories | Rename from `web/framework/react (@vince)/` to `web-framework-react/` |

### Test Files (50+ references)

- `src/cli-v2/lib/project-config.test.ts`
- `src/cli-v2/lib/stack-plugin-compiler.test.ts`
- `src/cli-v2/lib/__tests__/fixtures/create-test-source.ts`
- Multiple other test files with hardcoded skill IDs

---

## Implementation Steps

### Step 1: Create Normalization Utility

Create `src/cli-v2/lib/skill-id-normalizer.ts`:

```typescript
/**
 * Normalize skill ID to kebab-case format.
 *
 * Examples:
 * - "web/framework/react (@vince)" → "web-framework-react"
 * - "react (@vince)" → "react"
 * - "meta/methodology/anti-over-engineering (@vince)" → "meta-methodology-anti-over-engineering"
 */
export function normalizeSkillId(rawId: string): string {
  // Strip author suffix like " (@vince)"
  const withoutAuthor = rawId.replace(/\s*\(@[^)]+\)\s*$/, "");
  // Replace slashes with dashes
  const withDashes = withoutAuthor.replace(/\//g, "-");
  // Ensure lowercase
  return withDashes.toLowerCase();
}
```

### Step 2: Update Skill Extraction

**matrix-loader.ts** (line 134):
```typescript
// Before
const skillId = frontmatter.name;

// After
const skillId = normalizeSkillId(frontmatter.name);
```

**local-skill-loader.ts** (line 94):
```typescript
// Before
const skillId = frontmatter.name;

// After
const skillId = normalizeSkillId(frontmatter.name);
```

### Step 3: Update Configuration Files

**config/skills-matrix.yaml** - Update skill_aliases:
```yaml
# Before
skill_aliases:
  react: "web/framework/react (@vince)"
  zustand: "web/state/zustand (@vince)"

# After
skill_aliases:
  react: "web-framework-react"
  zustand: "web-state-zustand"
```

**src/cli-v2/consts.ts** - Update DEFAULT_PRESELECTED_SKILLS:
```typescript
// Before
export const DEFAULT_PRESELECTED_SKILLS = [
  "meta/methodology/anti-over-engineering (@vince)",
  // ...
];

// After
export const DEFAULT_PRESELECTED_SKILLS = [
  "meta-methodology-anti-over-engineering",
  // ...
];
```

### Step 4: Simplify Skill Copier

**skill-copier.ts** - Remove parsing complexity:
```typescript
// Before (line 167-178)
export function getFlattenedSkillDestPath(skill: ResolvedSkill): string {
  const skillFolderName = skill.alias || extractSkillNameFromId(skill.id);
  return path.join("skills", skillFolderName);
}

function extractSkillNameFromId(skillId: string): string {
  const match = skillId.match(/([^/]+)\s*\(@/);
  return match ? match[1].trim() : skillId;
}

// After
export function getFlattenedSkillDestPath(skill: ResolvedSkill): string {
  return path.join("skills", skill.id);
}
// extractSkillNameFromId() can be deleted
```

### Step 5: Rename Skill Directories

In the marketplace (`/home/vince/dev/claude-subagents`):
```
# Before
src/skills/web/framework/react (@vince)/
src/skills/web/state/zustand (@vince)/

# After
src/skills/web-framework-react/
src/skills/web-state-zustand/
```

### Step 6: Update Tests

Search and replace in test files:
- `"react (@vince)"` → `"react"` or `"web-framework-react"`
- `"web/framework/react (@vince)"` → `"web-framework-react"`

---

## Migration Considerations

### Breaking Changes

1. Existing `.claude/config.yaml` files reference old skill IDs
2. User projects with custom configurations will break
3. Any scripts referencing old IDs will break

### Migration Path

1. **v0.7.0**: Implement new format, add migration command
2. **Migration command**: `cc migrate` updates `.claude/config.yaml` to new format
3. **Documentation**: Release notes explain the breaking change
4. **Fallback**: Consider supporting both formats for one version (complexity tradeoff)

### Backwards Compatibility Option

Keep old aliases as secondary keys temporarily:
```yaml
skill_aliases:
  react: "web-framework-react"
  "react (@vince)": "web-framework-react"  # Legacy support
  "web/framework/react (@vince)": "web-framework-react"  # Legacy support
```

---

## Benefits After Migration

1. **Simpler code**: Remove regex parsing, special cases
2. **Consistent naming**: Matches CLAUDE.md kebab-case convention
3. **Cleaner folders**: `.claude/skills/web-framework-react/` instead of `.claude/skills/react (@vince)/`
4. **No author in ID**: Author is metadata, not identity
5. **Predictable**: ID format is obvious from category + name
