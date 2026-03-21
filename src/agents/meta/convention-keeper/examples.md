## Example Output

### Review Mode Example

```markdown
# Standards Review: 2026-03-21

## Findings Processed

| File                                         | Type         | Severity | Theme          |
| -------------------------------------------- | ------------ | -------- | -------------- |
| 2026-03-21-duplicated-skillspath-helper.md   | anti-pattern | medium   | DRY            |
| 2026-03-21-toequal-vs-tostrictequal.md       | standard-gap | medium   | Assertions     |
| 2026-03-21-missing-cleanup-in-smoke-tests.md | anti-pattern | high     | Test lifecycle |

## Theme Groups

### Group 1: DRY Violations (1 finding)

**Findings:** `2026-03-21-duplicated-skillspath-helper.md`

**Cross-reference result:** `CLAUDE.md` has "NEVER export constants only used within the same file" but no rule about duplicated helper functions across test files.

**Classification:** Documentation gap

**Proposal:**

**File:** `docs/standards/e2e/anti-patterns.md`
**Section:** Add after existing "Duplicated Constants" section

**Text to add:**

> ### Duplicated Helper Functions
>
> When the same helper logic appears in 2+ test files, extract it to `e2e/helpers/` or `e2e/fixtures/`. Check existing helpers before creating inline functions.
>
> Bad: Same `buildSkillsPath()` helper in 3 test files
> Good: Single export from `e2e/helpers/test-utils.ts`

### Group 2: Assertion Patterns (1 finding)

**Findings:** `2026-03-21-toequal-vs-tostrictequal.md`

**Cross-reference result:** `docs/standards/e2e/assertions.md` exists but has no rule about `toEqual` vs `toStrictEqual`.

**Classification:** Documentation gap

**Proposal:**

**File:** `docs/standards/e2e/assertions.md`
**Section:** Add to "Matcher Selection" section

**Text to add:**

> ### toEqual vs toStrictEqual
>
> Use `toStrictEqual` for object comparisons. `toEqual` ignores `undefined` properties, which can mask bugs where a field is unexpectedly missing.
>
> Bad: `expect(result).toEqual({ name: "test" })` -- passes even if result has extra undefined fields
> Good: `expect(result).toStrictEqual({ name: "test" })` -- fails if structure doesn't match exactly

## Summary

| Classification    | Count | Proposals            |
| ----------------- | ----- | -------------------- |
| Documentation gap | 2     | 2 new rules proposed |
| Enforcement gap   | 0     | -                    |
| Convention drift  | 0     | -                    |

Awaiting approval to apply proposals and move findings to `done/`.
```
