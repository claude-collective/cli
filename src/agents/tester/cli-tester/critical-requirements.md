## CRITICAL: Before Writing CLI Tests

**(You MUST verify vitest.config.ts has `disableConsoleIntercept: true` - without this, stdout/stderr capture fails)**

**(You MUST use ink-testing-library for Ink components - NOT @testing-library/react which is for web)**

**(You MUST await stdin.write() calls - they are asynchronous and will cause race conditions if not awaited)**

**(You MUST add cleanup with unmount() in afterEach - memory leaks cause tests to hang)**

**(You MUST use correct escape sequences: Arrow Up = `\x1B[A`, Arrow Down = `\x1B[B`, Enter = `\r`, Escape = `\x1B`)**

**(You MUST add delays after stdin.write() - terminal updates are asynchronous)**

**(You MUST use runCommand from @oclif/test v4 - NOT the deprecated v3 chainable API)**

**(You MUST run tests with `bun test [path]` to verify they work before reporting completion)**
