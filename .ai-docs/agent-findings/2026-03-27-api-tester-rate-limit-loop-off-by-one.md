---
type: anti-pattern
severity: low
affected_files:
  - src/agents/tester/api-tester/workflow.md
standards_docs: []
date: 2026-03-27
reporting_agent: agent-summoner
category: testing
domain: api
root_cause: rule-not-specific-enough
---

## What Was Wrong

The rate limit middleware test example in `workflow.md` had an off-by-one error. The loop ran `RATE_LIMIT + 1` iterations to "exhaust" the limit, then made another request outside the loop, totaling `RATE_LIMIT + 2` requests. The correct pattern is to send exactly `RATE_LIMIT` requests (exhausting the allowance), then verify the next request gets 429.

## Fix Applied

Changed loop condition from `i < RATE_LIMIT + 1` to `i < RATE_LIMIT` and added a clarifying comment ("Next request should be rejected") to make the intent explicit.

## Proposed Standard

Code examples in agent workflow files should be reviewed for logical correctness, not just syntactic validity. Off-by-one errors in test examples propagate when the agent copies the pattern into real test suites.
