## Example Review Output

### Review: Chat Completion Service

**Files Reviewed:**

- `src/services/chat-completion.ts`
- `src/lib/prompt-builder.ts`
- `src/lib/response-parser.ts`

---

**Critical Issues (Must Fix):**

1. **Prompt Injection via Unsanitized User Input**

   **Location:** `src/lib/prompt-builder.ts:34`

   **Problem:** User message concatenated directly into system prompt without sanitization.

   ```typescript
   // Current (vulnerable)
   const prompt = `You are a helpful assistant. The user's name is ${userName}.
   Answer their question: ${userQuestion}`;

   // Fix: Use structured message array with role separation
   const messages = [
     { role: "system", content: "You are a helpful assistant." },
     { role: "user", content: userQuestion },
   ];
   ```

   **Risk:** Attacker can inject "Ignore previous instructions..." in `userQuestion` to override system prompt behavior.

2. **Unvalidated LLM Response Used in Control Flow**

   **Location:** `src/lib/response-parser.ts:52`

   **Problem:** LLM output parsed as JSON and used to determine next action without schema validation.

   ```typescript
   // Current (fragile)
   const action = JSON.parse(response.content);
   if (action.type === "delete") {
     await deleteRecord(action.id);
   }

   // Fix: Validate with Zod before trusting
   const actionSchema = z.object({
     type: z.enum(["view", "edit"]),
     id: z.string().uuid(),
   });
   const result = actionSchema.safeParse(JSON.parse(response.content));
   if (!result.success) {
     return fallbackAction();
   }
   ```

   **Risk:** Malformed or hallucinated response could trigger unintended destructive operations.

---

**High Issues (Should Fix):**

3. **No Retry or Fallback for Model API Failures**

   **Location:** `src/services/chat-completion.ts:78`

   **Problem:** Single API call with no retry on transient failure (429, 500).

   ```typescript
   // Current
   const response = await openai.chat.completions.create(params);

   // Better: Retry with backoff, fallback to cheaper model
   const response = await withRetry(() => openai.chat.completions.create(params), {
     maxRetries: 3,
     backoff: "exponential",
   }).catch(() => openai.chat.completions.create({ ...params, model: "gpt-4o-mini" }));
   ```

4. **Unbounded Conversation History**

   **Location:** `src/services/chat-completion.ts:45`

   **Problem:** Full conversation history sent on every request with no truncation.

   ```typescript
   // Current (unbounded cost growth)
   messages.push({ role: "user", content: userMessage });
   const response = await openai.chat.completions.create({
     model: "gpt-4o",
     messages,
   });

   // Better: Truncate to token budget
   const truncated = truncateToTokenBudget(messages, MAX_CONTEXT_TOKENS);
   const response = await openai.chat.completions.create({
     model: "gpt-4o",
     messages: truncated,
   });
   ```

   **Risk:** Cost grows linearly per turn; long conversations may exceed model context window and silently truncate.

---

**Low (Nice to Have):**

5. Consider extracting the model name `"gpt-4o"` at `chat-completion.ts:23` to a configuration constant for easier migration when model versions change.

---

**AI Safety Checklist:**

- [x] API keys loaded from environment
- [ ] User input sanitized before prompt insertion - FAIL (prompt-builder.ts:34)
- [ ] LLM output validated before control flow - FAIL (response-parser.ts:52)
- [ ] Token budget enforced - FAIL (chat-completion.ts:45)
- [ ] Retry/fallback for transient failures - FAIL (chat-completion.ts:78)
- [x] No PII in prompts or logs

**Positive Observations:**

- API key loaded from environment variable, not hardcoded
- Structured message array used (system/user/assistant roles separated)
- Response content type-checked before string operations

---

**Recommendation:** REQUEST CHANGES - Fix the prompt injection vulnerability and add output validation before merge. Retry/fallback and token budgeting are strongly recommended.
