# E2E Testing Strategy Document: Consistency Audit

**Audited document:** `docs/research/e2e-testing-strategy.md` (1548 lines)
**Audit date:** 2026-02-25
**Auditor:** CLI tester agent

---

## Summary

The document has a clear research trajectory -- problem statement, tool evaluation, architecture proposal, real-world research, revised recommendation -- but it never reconciles its earlier sections with the later discoveries. The result is two competing `TerminalSession` designs, three competing ANSI-stripping approaches, two competing prebuilt node-pty forks, and contradictory test count targets. A reader following the document top-to-bottom would be unable to determine which recommendations are current without reading the entire 1548 lines.

---

## 1. Contradictions Between Sections

### 1.1 Two Competing TerminalSession Designs (MAJOR)

**Lines 249-334** present a `TerminalSession` class using:

- `import * as pty from "node-pty"` (namespace import from Microsoft's package)
- `strip-ansi` for output cleaning (`stripAnsi(this.output)`)
- `this.term.kill()` for cleanup (process.kill, not tree-kill)
- 100ms polling interval in `waitForText`
- `clearOutput()` method to reset buffer
- `destroy()` is synchronous (`void`)

**Lines 1404-1485** present a "Revised TerminalSession Design" using:

- `import pty from "@homebridge/node-pty-prebuilt-multiarch"` (default import from prebuilt fork)
- `@xterm/headless` virtual terminal (no strip-ansi at all)
- `treeKill()` for cleanup
- 50ms polling interval in `waitForText`
- No `clearOutput()` method (xterm buffer replaces rolling string)
- `destroy()` is async (`Promise<void>`)
- CI-aware timeouts (`process.env.CI ? 20_000 : 10_000`)

**Problem:** The earlier design is never marked as superseded. Both are presented under the same `TerminalSession` class name, same file path (`e2e/helpers/terminal-session.ts`), same section structure. A reader who stops at line 334 will implement something fundamentally different from a reader who reads to line 1485. The first version has methods (`clearOutput`, `arrowLeft`, `arrowRight`) that the second version drops, without explanation.

**Fix needed:** Mark the first version (lines 249-334) as "Initial draft -- superseded by Revised Design below" or remove it entirely. Add a cross-reference.

### 1.2 Three Competing ANSI Stripping Recommendations

The document recommends three different approaches to ANSI stripping without resolving which one to use:

| Location                          | Approach                                                 | Used In                                                                                         |
| --------------------------------- | -------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Lines 84, 221, 229, 251, 271, 438 | `strip-ansi` npm package                                 | Initial TerminalSession, Layer 3 example, implementation plan                                   |
| Lines 929-938, 1027, 1390, 1412   | `node:util` `stripVTControlCharacters`                   | "What We Should Adopt" table, Vitest pattern, Revised TerminalSession import (but never called) |
| Lines 870-874, 1404-1485          | `@xterm/headless` virtual terminal (no stripping needed) | tui-test pattern, Revised TerminalSession                                                       |

**Specific contradictions:**

- Line 438 (Implementation Plan Phase 1): "Install dependencies: `node-pty`, `execa`, `strip-ansi`" -- still lists `strip-ansi` as a dependency to install, even though the Revised Design does not use it.
- Line 521 (Risk Assessment): "Use `NO_COLOR=1`, `strip-ansi`, normalize line endings" -- recommends `strip-ansi` as a mitigation.
- Line 1390 ("What We Should Adopt" table): Lists `stripVTControlCharacters` as a "fallback" but the parenthetical "(fallback)" is unexplained. Fallback to what? If xterm-headless is the primary approach, say so. If `stripVTControlCharacters` is the primary for Layer 3 (execa) tests, say that.
- Line 1412 (Revised TerminalSession): Imports `stripVTControlCharacters` but never calls it anywhere in the class. Dead import.

**Fix needed:** Decide: (1) xterm-headless for PTY tests (Layer 4), (2) `stripVTControlCharacters` for execa tests (Layer 3), (3) `strip-ansi` is not used. Update the Implementation Plan dependencies, Risk Assessment, and remove the dead import.

### 1.3 Two Competing Prebuilt node-pty Forks

- Lines 83, 518, 535, 878, 1410, 1506: Recommend `@homebridge/node-pty-prebuilt-multiarch`
- Line 807: "Use `@lydell/node-pty` for prebuilt binaries to avoid this"
- Line 1548: Lists `@lydell/node-pty` as a reference

**Problem:** These are two different packages. The document recommends `@homebridge` in 6 places and `@lydell` in 1 place, without comparing them or stating which to use. The CI Gotchas section (line 807) specifically recommends `@lydell`, contradicting every other section.

**Fix needed:** Pick one. Add a brief comparison or state why one is preferred. Remove the other from recommendations (can keep in references as "alternative considered").

### 1.4 Test Count Targets Contradict

Three different target ranges appear:

| Location                       | Target                                            |
| ------------------------------ | ------------------------------------------------- |
| Line 542 (Decision Points)     | "20-30 E2E tests covering critical user journeys" |
| Line 820 (Performance Reality) | "For 20-30 PTY tests at ~5s each"                 |
| Line 853 (Honest Assessment)   | "5-15 critical journey tests, not hundreds"       |
| Line 860 (Honest Assessment)   | "10-20 PTY E2E tests for critical paths"          |

**Problem:** The range shifts from 20-30 down to 5-15 and then to 10-20, all within the same document. A reader cannot determine whether to plan for 5 or 30 PTY tests.

**Fix needed:** Settle on one range and use it consistently. If the intent is "10-20 PTY (Layer 4) + some execa (Layer 3) = 20-30 total E2E", state that explicitly.

### 1.5 Risk Assessment vs Hard Truths: Tone Contradiction

**Risk Assessment (lines 514-523)** presents mitigations as if the problems are straightforward:

- "Robust `waitFor()` with generous timeouts, retry on CI" for flakiness
- "Use `NO_COLOR=1`, `strip-ansi`, normalize line endings" for platform differences

**Hard Truths (lines 741-861)** then reveals these same problems are much worse than the Risk Assessment suggests:

- The exit/data race condition is "FUNDAMENTAL" and occurs "approximately 1 in 5 runs" (line 751)
- `strip-ansi` is explicitly stated as insufficient: it "removes color codes but NOT cursor movement codes" (line 765)
- Platform differences include "Windows ConPTY echoes ALL input in output" and "macOS 4KB kernel pipe buffer" (lines 786-787)
- The mitigation for flakiness is "Target Linux-only for PTY tests initially" (line 790) -- much more severe than "retry on CI"

**Problem:** The Risk Assessment reads as a confident "we can handle this" section. The Hard Truths section, written after deeper research, essentially invalidates several Risk Assessment mitigations. But the Risk Assessment is never updated.

**Fix needed:** Either update the Risk Assessment to reflect Hard Truths findings, or add a note: "See Hard Truths section below for deeper analysis of these risks."

### 1.6 Color Disabling: NO_COLOR vs FORCE_COLOR

- Lines 98, 263: Initial examples use `NO_COLOR: "1"` only
- Lines 940-946: Research section identifies `FORCE_COLOR: "0"` as the industry standard
- Line 1400 ("What We Should Adopt"): Recommends `FORCE_COLOR: "0"`
- Line 1427 (Revised TerminalSession): Uses both `NO_COLOR: "1"` AND `FORCE_COLOR: "0"`

**Problem:** Minor, but the initial examples only set `NO_COLOR` while the research reveals `FORCE_COLOR` is what every project uses. The revised design uses both (belt-and-suspenders), which is fine, but the earlier examples are inconsistent.

**Fix needed:** Update initial examples or add a note explaining the dual approach.

---

## 2. Stale / Superseded Content

### 2.1 Layer 3 Example Uses strip-ansi (Lines 218-239)

The Layer 3 (Binary Non-Interactive E2E) code example at line 221 imports `strip-ansi`:

```typescript
import stripAnsi from "strip-ansi";
// ...
expect(stripAnsi(stdout)).toContain("Compiled");
```

After the research section establishes that `stripVTControlCharacters` from `node:util` is the standard (line 929-938), this example is stale. It should use `stripVTControlCharacters` for consistency with the "What We Should Adopt" table.

### 2.2 Layer 4 Initial TerminalSession (Lines 249-334)

This entire code block is superseded by the Revised Design at lines 1404-1485. It uses:

- Wrong package (`node-pty` vs `@homebridge/node-pty-prebuilt-multiarch`)
- Wrong approach (string buffer + strip-ansi vs xterm-headless)
- Wrong cleanup (synchronous `this.term.kill()` vs async tree-kill)
- Wrong polling interval (100ms vs 50ms)

This is not just "an earlier draft" -- it is architecturally different and would produce different behavior.

### 2.3 Implementation Plan Phase 1 (Line 438)

Still says "Install dependencies: `node-pty`, `execa`, `strip-ansi`". Should be updated to reflect the revised dependency list: `@homebridge/node-pty-prebuilt-multiarch`, `@xterm/headless`, `execa`, `tree-kill`.

### 2.4 node-pty Example (Lines 88-111)

The standalone node-pty example at line 91 uses `import * as pty from "node-pty"` (namespace import from the Microsoft package). This is a basic "here's how node-pty works" illustration, which is fine for educational context, but it contradicts the final recommendation to use `@homebridge/node-pty-prebuilt-multiarch` with a default import.

### 2.5 References Section Lists strip-ansi (Line 1505)

Line 1505 lists `strip-ansi` as a recommended tool. If the final recommendation is to use `@xterm/headless` (PTY) and `stripVTControlCharacters` (execa), then `strip-ansi` should be listed under "considered but not adopted" or removed from the primary tools list.

---

## 3. Redundancy

### 3.1 node-pty Limitations Mentioned in 4+ Places

The same node-pty limitations (native compilation, timing sensitivity, exit/data race, platform differences) appear in:

1. **Tool evaluation** (lines 80-86): "Native module requiring C++ compilation... Timing-sensitive..."
2. **Risk Assessment** (lines 514-523): Full table of risks
3. **Hard Truths** (lines 741-861): Deep dive into each limitation
4. **Known Issues reference list** (lines 1536-1548): Issue-by-issue listing

The information escalates in depth (brief mention -> table -> deep analysis -> issue links), which is a reasonable research narrative. However, items like "exit fires before data delivered" are described in all four locations. The Risk Assessment table could simply cross-reference the Hard Truths section rather than duplicating mitigations.

### 3.2 Escape Sequences Defined in Multiple Code Blocks

Escape sequences appear in:

- Lines 107-108: `\x1b[B` and `\r` in bare node-pty example
- Lines 296-316: Full method set in first TerminalSession
- Lines 1063-1064: `ARROW_DOWN = "\u001B[B"` and `ENTER = "\n"` in Vitest example
- Lines 1470-1476: Method set in Revised TerminalSession

Note the Vitest example at line 1064 uses `ENTER = "\n"` while both TerminalSession implementations use `"\r"`. This is because Vitest uses stdin.emit (in-process), not PTY write. This subtle difference is not explained.

### 3.3 waitForText Implementation Appears Twice

The `waitForText` polling loop appears at lines 277-288 (first TerminalSession) and lines 1454-1467 (Revised TerminalSession), with different timeout defaults (10_000 vs CI-aware) and different polling intervals (100ms vs 50ms). The second version is strictly better. The first should be removed or marked as draft.

### 3.4 Verdaccio Setup Shown Three Times

Three different Verdaccio startup patterns:

1. Lines 382-403: globalSetup with `fork()` (document's own recommendation)
2. Lines 1261-1289: Programmatic `runServer()` (rluvaton pattern)
3. Lines 1294-1307: Fork-based with `on()` events (Angular CLI pattern)

Plus a Docker variant at lines 1326-1338. The "What We Should Adopt" table (line 1396) picks programmatic `runServer()`, but the document's own globalSetup example at line 388 uses `fork()`. These contradict.

---

## 4. Numbering and Flow

### 4.1 Implementation Plan Numbering

The plan uses continuous numbering across phases (1-17), which works but is unusual. Phase boundaries are marked by headings. The numbering is consistent and unambiguous.

### 4.2 Decision Points Resolution

| Decision Point                          | Line | Resolved Later?                                                                      |
| --------------------------------------- | ---- | ------------------------------------------------------------------------------------ |
| 1. E2E directory location               | 529  | Yes -- all examples use `e2e/`                                                       |
| 2. `--non-interactive` flags            | 532  | Partially -- mentioned but not decided                                               |
| 3. `@homebridge` vs compile from source | 535  | YES in examples, but contradicted by `@lydell` at line 807                           |
| 4. Verdaccio Docker vs npm              | 538  | Contradicted -- "What We Should Adopt" picks programmatic, but own example uses fork |
| 5. How many E2E tests                   | 541  | Contradicted -- 20-30 here, 5-15 and 10-20 later                                     |

Decision Point 3 is answered by the code examples but then muddied by line 807 recommending a different package. Decision Points 4 and 5 are contradicted by later content.

### 4.3 Narrative Arc

The document follows: Problem -> Tools -> Architecture -> Plan -> Risks -> Journeys -> File Assertions -> Hard Truths -> Production Patterns -> Revised Design.

The issue is that the "Architecture" and "Plan" sections (lines 195-510) present a complete, confident proposal. Then "Hard Truths" (lines 741-861) undermines key assumptions. Then "Production Patterns" (lines 864-1401) introduces better solutions. Then "Revised Design" (lines 1404-1485) presents the actual recommendation.

A reader must read the entire document to know what is actually recommended. The first half reads as the final word, but it is not.

**Suggested restructure:** Add a "Document Structure" note at the top explaining the research progression, or move the Revised Design up and clearly mark the initial design as "initial exploration."

---

## 5. Tool Recommendations -- Final Word Unclear

### 5.1 ANSI Stripping

| Section                             | Recommendation                                                                        |
| ----------------------------------- | ------------------------------------------------------------------------------------- |
| Tool Evaluation (line 84)           | `strip-ansi`                                                                          |
| Layer 3 Example (line 221)          | `strip-ansi`                                                                          |
| Implementation Plan (line 438)      | `strip-ansi`                                                                          |
| Risk Assessment (line 521)          | `strip-ansi`                                                                          |
| Production Patterns (line 931)      | `stripVTControlCharacters` from `node:util`                                           |
| "What We Should Adopt" (line 1390)  | `stripVTControlCharacters` (fallback)                                                 |
| Revised TerminalSession (line 1412) | Imports `stripVTControlCharacters` but never calls it; uses `@xterm/headless` instead |

**Final word is ambiguous.** The Revised Design imports `stripVTControlCharacters` but relies on `@xterm/headless` for screen reading. The import appears dead. For Layer 3 (execa) tests, `stripVTControlCharacters` is presumably the answer, but this is never stated explicitly.

### 5.2 Prebuilt node-pty

| Section               | Recommendation                            |
| --------------------- | ----------------------------------------- |
| 6 locations           | `@homebridge/node-pty-prebuilt-multiarch` |
| 1 location (line 807) | `@lydell/node-pty`                        |

**Final word:** Likely `@homebridge` based on frequency and usage in code examples, but `@lydell` at line 807 is never retracted.

### 5.3 Process Cleanup

| Section                             | Recommendation                                          |
| ----------------------------------- | ------------------------------------------------------- |
| Initial TerminalSession (line 332)  | `this.term.kill()` (process.kill)                       |
| tui-test example (line 908)         | `process.kill(this._pty.pid, 9)`                        |
| Production Patterns (line 949)      | `tree-kill` (explicitly: "tree-kill, Not process.kill") |
| Revised TerminalSession (line 1480) | `treeKill()`                                            |

**Final word is clear:** `tree-kill`. But the initial TerminalSession and tui-test example show the wrong approach without annotation.

### 5.4 Sequential Execution Strategy

| Section                                 | Recommendation                                      |
| --------------------------------------- | --------------------------------------------------- |
| Vitest Config (line 505)                | `pool: "forks"` + `singleFork: true`                |
| Vitest E2E Config example (line 1089)   | `fileParallelism: false` (no mention of singleFork) |
| "What We Should Adopt" (line 1398-1399) | `fileParallelism: false` AND `pool: "forks"`        |

**Minor inconsistency.** The initial config uses `singleFork: true` which forces all tests into one fork. The Vitest example uses `fileParallelism: false` which prevents parallel files but allows parallel tests within a file. The "What We Should Adopt" table lists both `fileParallelism: false` and `pool: "forks"` but not `singleFork: true`. These achieve similar but not identical behavior.

---

## 6. Other Issues

### 6.1 tui-test Adoption vs Building Our Own

The document discovers `tui-test` (lines 868-921) and calls it "Playwright for terminals." Then it builds a custom `TerminalSession` class (lines 1404-1485) that reimplements tui-test's core pattern. The document never addresses: why not use tui-test directly? If the answer is "it's too opinionated" or "121 stars is too few" or "we need a thinner wrapper," that reasoning should be stated.

### 6.2 Dead Import in Revised TerminalSession

Line 1412: `import { stripVTControlCharacters } from "node:util";` is imported but never used in the class body. The class uses `this.xterm.buffer` for screen reading, making `stripVTControlCharacters` unnecessary.

### 6.3 Missing Methods in Revised TerminalSession

The initial TerminalSession (lines 296-316) includes `arrowLeft()`, `arrowRight()`, and `clearOutput()`. The Revised TerminalSession (lines 1468-1476) drops all three without explanation. If the revised version is the final recommendation, these omissions should be intentional and noted, or the methods should be included.

### 6.4 Cleanup Pattern: try/finally vs onTestFinished

The Layer 4 example test (line 369) uses `try/finally` with `session.destroy()`. The "What We Should Adopt" table (line 1392) recommends `onTestFinished` auto-cleanup (Vitest pattern). These are different approaches, and the document does not reconcile them.

---

## Recommendations

1. **Add a "Reading Guide" at the top** explaining the document progresses from initial research to revised recommendations, and that later sections supersede earlier ones.

2. **Mark the initial TerminalSession (lines 249-334) as superseded** with a clear note pointing to the Revised Design.

3. **Update the Implementation Plan (lines 436-488)** to reflect the revised dependency list and approach.

4. **Update the Risk Assessment (lines 514-523)** to cross-reference Hard Truths or incorporate the deeper analysis.

5. **Resolve the prebuilt node-pty fork question** -- pick `@homebridge` or `@lydell` and note the other as an alternative.

6. **Resolve the ANSI stripping question** explicitly: xterm-headless for Layer 4, `stripVTControlCharacters` for Layer 3, `strip-ansi` not used.

7. **Settle on a test count target** -- one range, used consistently.

8. **Remove the dead `stripVTControlCharacters` import** from the Revised TerminalSession.

9. **Add the missing methods** (`arrowLeft`, `arrowRight`) to the Revised TerminalSession or note their intentional removal.

10. **Explain why tui-test is not adopted directly** -- the document shows its architecture approvingly but then reimplements it.
