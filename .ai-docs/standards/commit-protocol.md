# Commit Protocol for AI Agents

Quick reference for AI agents making commits to this repository.

## Commit Standards

### Conventional Commits Format

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

**Types:** `feat`, `fix`, `docs`, `test`, `refactor`, `chore`, `style`, `perf`

**Examples:**

- `feat(wizard): add domain selection step`
- `fix(compile): ensure output directory exists before dry-run`
- `docs: update TODO with task progress`
- `test: refactor tests to use shared helpers`

### Co-Author Rules

- ❌ **NEVER add Claude as co-author**
- ❌ Do NOT include `Co-Authored-By: Claude` in commit messages

## Sequential Commits

When creating multiple commits in sequence:

1. ✅ Run tests on the **first commit** only
2. ✅ Run tests on the **last commit** only
3. ❌ Skip tests for intermediate commits (use `--no-verify`)

## Release Checklist

Every release MUST complete all steps. No exceptions.

- [ ] Bump version in `package.json` (semver: major = breaking, minor = feature, patch = fix)
- [ ] Create `changelogs/{version}.md` with full release notes
- [ ] Prepend brief summary to `CHANGELOG.md` with link to detailed file
- [ ] Commit with message: `chore(release): {version} — brief summary`
- [ ] Never edit old entries in `CHANGELOG.md` or old `changelogs/` files

### CHANGELOG.md Format (Summary)

```markdown
## [{version}] - {date}

**Brief one-line summary**

Key highlights (2-3 bullets max)

See [changelogs/{version}.md](./changelogs/{version}.md) for full details.
```

### changelogs/{version}.md Format (Detailed)

```markdown
# Release {version} ({date})

## Added

- Feature descriptions with context

## Changed

- Modification descriptions

## Fixed

- Bug fix descriptions

## Removed

- Removed feature descriptions
```
