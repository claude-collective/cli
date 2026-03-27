## Output Format

<output_format>
Provide your implementation in this structure:

<summary>
**Task:** [Brief description of what was implemented]
**Status:** [Complete | Partial | Blocked]
**Files Changed:** [count] files ([+additions] / [-deletions] lines)
</summary>

<investigation>
**Files Examined:**

| File            | Lines | What Was Learned             |
| --------------- | ----- | ---------------------------- |
| [/path/to/file] | [X-Y] | [Pattern/utility discovered] |

**Patterns Identified:**

- **LLM integration:** [How API calls are structured - from /path:lines]
- **Prompt design:** [How prompts are templated - from /path:lines]
- **Error handling:** [How LLM errors are managed - from /path:lines]
- **Response parsing:** [How output is validated - from /path:lines]

**Existing Code Reused:**

- [Utility/module] from [/path] - [Why reused instead of creating new]
  </investigation>

<approach>
**Summary:** [1-2 sentences describing the implementation approach]

**Files:**

| File            | Action             | Purpose               |
| --------------- | ------------------ | --------------------- |
| [/path/to/file] | [created/modified] | [What change and why] |

**Key Decisions:**

- [Decision]: [Rationale based on existing patterns from /path:lines]
  </approach>

<implementation>

### [filename.ts]

**Location:** `/absolute/path/to/file.ts`
**Changes:** [Brief description - e.g., "New RAG pipeline" or "Added retry logic"]

```typescript
// [Description of this code block]
[Your implementation code]
```

### [filename2.ts] (if applicable)

[Same structure...]

</implementation>

<ai_design>

## AI Design Decisions

### Model Selection

| Use Case       | Model        | Rationale                   |
| -------------- | ------------ | --------------------------- |
| [Primary task] | [model name] | [Why this model fits]       |
| [Fallback]     | [model name] | [Cost/capability trade-off] |

### Token Budget

| Component        | Budget   | Strategy if Exceeded               |
| ---------------- | -------- | ---------------------------------- |
| System prompt    | [tokens] | [Fixed - not compressible]         |
| Context/RAG      | [tokens] | [Truncate oldest / re-rank]        |
| User input       | [tokens] | [Summarize if over limit]          |
| Response reserve | [tokens] | [Minimum needed for useful output] |

### Prompt Design

- **Template approach:** [Parameterized / few-shot / chain-of-thought]
- **Output format:** [JSON mode / tool_use / free text + regex]
- **Validation:** [Zod schema / manual parse / retry on failure]

### Error Recovery

| Failure Mode      | Strategy                                  |
| ----------------- | ----------------------------------------- |
| Rate limit (429)  | Exponential backoff with jitter           |
| Timeout           | Retry with shorter prompt / cheaper model |
| Malformed output  | Re-prompt with correction hint            |
| Content filter    | Log + return safe fallback                |
| Model unavailable | Fallback to alternate model               |

</ai_design>

<tests>

### [filename.test.ts]

**Location:** `/absolute/path/to/file.test.ts`

```typescript
[Test code covering the implementation]
```

**Coverage:**

- [x] Happy path: [scenario]
- [x] Malformed LLM response: [scenarios]
- [x] Token limit exceeded: [scenarios]
- [x] API failure + retry: [scenarios]
- [x] Streaming interruption: [scenarios]

**Test Commands:**

```bash
# Run tests for this feature
[specific test command]
```

</tests>

<verification>

## Success Criteria

| Criterion            | Status    | Evidence                                       |
| -------------------- | --------- | ---------------------------------------------- |
| [From specification] | PASS/FAIL | [How verified - test name, manual check, etc.] |

## Universal Quality Checks

**AI Integration:**

- [ ] All LLM responses validated with schemas
- [ ] Token counts checked before API calls
- [ ] Retry logic with exponential backoff on all LLM calls
- [ ] Model names in config, not hardcoded
- [ ] Prompts use parameterized templates
- [ ] Agent loops have max iteration limits

**Error Handling:**

- [ ] Rate limit (429) handled with backoff
- [ ] Timeout handled with retry or fallback
- [ ] Malformed output handled with re-prompt or safe fallback
- [ ] Content filter responses handled gracefully
- [ ] Streaming connection drops handled

**Cost Awareness:**

- [ ] Cheapest capable model selected for each task
- [ ] Embeddings cached where possible
- [ ] Batch operations used where available
- [ ] No redundant LLM calls

**Code Quality:**

- [ ] No magic numbers (named constants used)
- [ ] No `any` types without justification
- [ ] Follows existing naming conventions
- [ ] Follows existing file/folder structure

## Build & Test Status

- [ ] Existing tests pass
- [ ] New tests pass (if added)
- [ ] Build succeeds
- [ ] No type errors
- [ ] No lint errors

</verification>

<notes>

## For Reviewer

- [Areas to focus review on - e.g., "The prompt template design"]
- [Decisions that may need discussion]
- [Alternative approaches considered and why rejected]

## Scope Control

**Added only what was specified:**

- [Feature implemented as requested]

**Did NOT add:**

- [Unrequested feature avoided - why it was tempting but wrong]

## Known Limitations

- [Any scope reductions from spec]
- [Technical debt incurred and why]
- [Non-deterministic edge cases documented]

## Dependencies

- [New packages added: none / list with justification]
- [Breaking changes: none / description]
- [API key requirements: list any new env vars needed]

</notes>

</output_format>

---

## Section Guidelines

### When to Include Each Section

| Section            | When Required                     |
| ------------------ | --------------------------------- |
| `<summary>`        | Always                            |
| `<investigation>`  | Always - proves research was done |
| `<approach>`       | Always - shows planning           |
| `<implementation>` | Always - the actual code          |
| `<ai_design>`      | When LLM calls are added/modified |
| `<tests>`          | When tests are part of the task   |
| `<verification>`   | Always - proves completion        |
| `<notes>`          | When there's context for reviewer |
