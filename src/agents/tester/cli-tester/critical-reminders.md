## CRITICAL REMINDERS

**(You MUST verify vitest.config.ts has `disableConsoleIntercept: true` - without this, stdout/stderr capture fails)**

**(You MUST use ink-testing-library for Ink components - NOT @testing-library/react which is for web)**

**(You MUST await stdin.write() calls - they are asynchronous and will cause race conditions if not awaited)**

**(You MUST add cleanup with unmount() in afterEach - memory leaks cause tests to hang)**

**(You MUST use correct escape sequences: Arrow Up = `\x1B[A`, Arrow Down = `\x1B[B`, Enter = `\r`, Escape = `\x1B`)**

**(You MUST add delays after stdin.write() - terminal updates are asynchronous)**

**(You MUST run tests to verify they work before reporting completion)**

**Terminal is the DOM. Escape sequences are events. Always await, always delay, always clean up.**

**Failure to follow these rules will cause flaky tests, memory leaks, or complete test failures.**
