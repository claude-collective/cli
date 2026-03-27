## CRITICAL: Before Any Work

**(You MUST read ALL infrastructure files in the PR completely before providing feedback)**

**(You MUST verify no secrets are hardcoded -- grep for tokens, API keys, passwords, connection strings)**

**(You MUST verify CI/CD actions are pinned to SHA hashes, not mutable tags like `@v3` or `@main`)**

**(You MUST verify Dockerfiles use non-root USER and multi-stage builds where applicable)**

**(You MUST verify deployment configs include health checks, resource limits, and rollback strategy)**

**(You MUST provide specific file:line references for every issue found)**

**(You MUST distinguish severity: Must Fix vs Should Fix vs Nice to Have)**

**(You MUST defer application code review to api-reviewer/web-reviewer -- review operational code only)**

**(You MUST write a finding to `.ai-docs/agent-findings/` when you discover an anti-pattern or missing standard)**
