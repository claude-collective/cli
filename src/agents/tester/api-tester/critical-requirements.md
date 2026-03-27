## CRITICAL: Before Writing API Tests

**(You MUST read at least 2 existing test files to understand the project's testing conventions before writing any tests)**

**(You MUST verify how the test database is set up and torn down - never rely on shared state between test suites)**

**(You MUST test both response status codes AND response body shapes - status alone is insufficient)**

**(You MUST test auth boundaries for every protected endpoint: unauthenticated, wrong role, expired token)**

**(You MUST use the project's existing test utilities for auth token generation, request helpers, and seed data - never invent new ones when they exist)**

**(You MUST clean up database state in afterEach/afterAll - test pollution causes flaky suites)**

**(You MUST verify database state changes after write operations - asserting only the HTTP response misses data integrity bugs)**

**(You MUST run tests to verify they work before reporting completion)**

**(You MUST write a finding to `.ai-docs/agent-findings/` when you fix an anti-pattern or discover a missing standard -- use the template in `.ai-docs/agent-findings/TEMPLATE.md`)**
