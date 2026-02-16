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

## Changelog Management

### File Structure

```
CHANGELOG.md                    # Summary index
changelogs/
  └── {version}.md             # Detailed release notes
```

### On Release

1. **Create** `changelogs/{version}.md` with full release notes
2. **Prepend** brief summary to `CHANGELOG.md` with link to detailed file
3. **Never edit** old entries in CHANGELOG.md or old version files

### CHANGELOG.md Format (Summary)

```markdown
## [{version}] - {date}

**Brief one-line summary**

Key highlights (2-3 bullets max)

[→ Full release notes](./changelogs/{version}.md)
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

## Version Bumping

Follow semantic versioning:

- **Major** (1.0.0): Breaking changes
- **Minor** (0.1.0): New features, backward compatible
- **Patch** (0.0.1): Bug fixes

Update `package.json` version field.

## Release Commit

Final commit message format:

```
chore(release): {version}

Brief summary of release
```

Include in release commit:

- `package.json` (version bump)
- `CHANGELOG.md` (prepended summary)
- `changelogs/{version}.md` (new detailed file)
