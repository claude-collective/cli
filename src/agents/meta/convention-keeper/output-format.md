## Output Format

<output_format>

### Review Mode

<findings_summary>

## Findings Processed

| File       | Type                    | Severity   | Theme         |
| ---------- | ----------------------- | ---------- | ------------- |
| [filename] | [type from frontmatter] | [severity] | [theme group] |

</findings_summary>

<theme_groups>

## Theme Groups

### Group N: [Theme Name] ([count] findings)

**Findings:** [list of finding filenames]

**Cross-reference result:** [Which docs were checked and what was found]

**Classification:** [enforcement gap | documentation gap | convention drift]

**Proposal:**

**File:** [exact path to target doc]
**Section:** [which section to add to or modify]

**Text to add:**

> [exact text ready to paste into the doc]

**Addresses findings:** [list of finding filenames this resolves]

</theme_groups>

<review_summary>

## Summary

| Classification    | Count | Proposals                  |
| ----------------- | ----- | -------------------------- |
| Documentation gap | [N]   | [N] new rules proposed     |
| Enforcement gap   | [N]   | [N] rules to strengthen    |
| Convention drift  | [N]   | [N] flagged for discussion |

**Next steps:** Awaiting approval to apply proposals and move findings to `done/`.

</review_summary>

### Audit Mode

<audit_results>

## Audit: [Standards Doc Name]

**File audited:** [path to standards doc]
**Rules checked:** [count]
**Violations found:** [count]

| Rule        | Violation      | Location    | Severity          |
| ----------- | -------------- | ----------- | ----------------- |
| [Rule text] | [What's wrong] | [file:line] | [high/medium/low] |

**Findings written:** [count] files created in `.agents-docs/findings/`

</audit_results>

### Gap Analysis Mode

<gap_analysis>

## Gap Analysis: Last [N] Commits

**Commits analyzed:** [count]
**Files frequently changed:** [list]

| Emerging Pattern | Evidence                      | Suggested Doc | Proposed Rule   |
| ---------------- | ----------------------------- | ------------- | --------------- |
| [Pattern]        | [commit refs or file changes] | [target doc]  | [one-line rule] |

</gap_analysis>

</output_format>

---

## Section Guidelines

### Proposal Quality Requirements

Every proposal must include:

1. **Exact target file path** - which standards doc to update
2. **Exact target section** - where in the doc to add the rule
3. **Ready-to-paste text** - the exact wording to add (not a description of what to add)
4. **Finding references** - which finding files this addresses

### What Makes a Good Rule

| Quality        | Description                                                        |
| -------------- | ------------------------------------------------------------------ |
| **Actionable** | "Use `toStrictEqual` for objects" not "Be careful with assertions" |
| **Specific**   | Names the exact pattern, matcher, or function                      |
| **Evidenced**  | Points to the finding that motivated it                            |
| **Concise**    | One rule per concern, 2-4 lines max                                |
| **Located**    | Lives near related rules in existing docs                          |

### Cross-Reference Checklist

For each finding group, check these locations:

1. `CLAUDE.md` - NEVER/ALWAYS sections
2. `docs/standards/clean-code-standards.md` - general code standards
3. `docs/standards/e2e/` - all E2E-specific docs (if test-related)
4. `docs/standards/e2e/anti-patterns.md` - known anti-patterns
5. `docs/standards/e2e/assertions.md` - assertion rules
6. `docs/standards/e2e/page-objects.md` - page object model patterns
7. `docs/standards/e2e/patterns.md` - reusable patterns
8. `docs/standards/e2e/test-data.md` - test data conventions
9. `docs/standards/e2e/test-structure.md` - test organization

### Severity Guide for Audit Mode

| Severity   | Criteria                                                   |
| ---------- | ---------------------------------------------------------- |
| **High**   | Rule violation that causes bugs, flaky tests, or data loss |
| **Medium** | Rule violation that causes maintenance burden or confusion |
| **Low**    | Style/convention violation with no functional impact       |
