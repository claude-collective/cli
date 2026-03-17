# D-105: Split `infra-tooling-setup-tooling` into 4 atomic skills

## Problem

The current `infra-tooling-setup-tooling` skill is a kitchen-sink covering 5 distinct tools across ~1000+ lines: ESLint 9, Prettier, Vite, TypeScript configuration, and Git hooks (Husky/lint-staged/commitlint). When an agent loads it to configure Vite, it also gets ESLint migration guidance. When it needs Husky setup, it gets Rolldown advancedChunks content.

Additionally, the skill is monorepo-centric — everything assumes `@repo/eslint-config`, `@repo/prettier-config`, `@repo/typescript-config` shared packages. Standalone projects don't need this pattern.

## Solution

Split into 4 atomic skills and introduce a new `web-tooling` category.

### New Skills

| Skill ID                           | Category            | Content                                                                                                                                                                                                     |
| ---------------------------------- | ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `shared-tooling-eslint-prettier`   | `shared-tooling`    | ESLint 9 flat config, defineConfig(), globalIgnores(), typescript-eslint v8, eslint-plugin-only-warn, ESLint 10 migration, Prettier v3.0+ config, shared config pattern, eslint-config-prettier integration |
| `shared-tooling-typescript-config` | `shared-tooling`    | Shared TypeScript strict mode configs, TS 5.x options (verbatimModuleSyntax, module: "preserve", moduleDetection: "force", ${configDir}), path alias sync, specialized configs (react.json, node.json)      |
| `shared-tooling-git-hooks`         | `shared-tooling`    | Husky v9 setup + migration from v8, lint-staged patterns, commitlint + conventional commits, VS Code integration (format-on-save, eslint-on-save, recommended extensions), CI/production handling           |
| `web-tooling-vite`                 | `web-tooling` (new) | Vite config, path aliases, vendor chunk splitting (manualChunks), environment-specific builds, Rolldown/advancedChunks, Environment API, Sass modern API, build targets, module preload config              |

### New Category: `web-tooling`

- **Domain:** `web`
- **Purpose:** Frontend build tools and bundlers
- **Future skills:** Webpack, Rspack, Turbopack, Rolldown (standalone)
- **Dividing line:** `shared-tooling` = language/quality tools (ESLint, Prettier, Biome). `web-tooling` = bundlers/build tools (Vite, Webpack, Rspack).

### Why This Split

- **ESLint + Prettier** are tightly coupled (eslint-config-prettier, format-on-save alongside lint-on-save) — they belong together
- **Vite** is a web/frontend build tool, not a linting tool — misplaced in a "build tooling" skill alongside ESLint
- **TypeScript config** is foundational but independent of linting — agents configuring tsconfig don't need ESLint content
- **Git hooks** are an optional workflow concern — many projects don't use Husky at all

### Coupling That Stays

- ESLint + Prettier remain in one skill (always used together)
- Each skill can cross-reference the others via "Related skills" section
- Path alias sync note appears in both `typescript-config` and `vite` (configured in both places)

## Implementation

1. Create the 4 new skill directories in `/home/vince/dev/skills/src/skills/`
2. Extract content from the existing skill's SKILL.md, reference.md, and examples/ into the new skills
3. Add `web-tooling` category to `skill-categories.ts` in the CLI repo
4. Create metadata.yaml for each new skill
5. Remove the old `infra-tooling-setup-tooling` skill
6. Update any stacks that reference the old skill
7. Update `skill-rules.ts` if any rules reference the old skill ID

## Checklist

- [ ] Create `shared-tooling-eslint-prettier` (SKILL.md, metadata.yaml, reference.md, examples/)
- [ ] Create `shared-tooling-typescript-config` (SKILL.md, metadata.yaml, reference.md, examples/)
- [ ] Create `shared-tooling-git-hooks` (SKILL.md, metadata.yaml, reference.md, examples/)
- [ ] Create `web-tooling-vite` (SKILL.md, metadata.yaml, reference.md, examples/)
- [ ] Add `web-tooling` category to `skill-categories.ts`
- [ ] Remove `infra-tooling-setup-tooling`
- [ ] Update stacks referencing old skill
- [ ] Update skill-rules.ts if needed
- [ ] Verify all skills pass metadata validation
