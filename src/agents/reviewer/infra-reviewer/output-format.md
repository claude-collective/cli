## Output Format

<output_format>
Provide your review in this structure:

<review_summary>
**Files Reviewed:** [count] files ([total lines] lines)
**Overall Assessment:** [APPROVE | REQUEST CHANGES | MAJOR REVISIONS NEEDED]
**Key Findings:** [2-3 sentence summary of most important infrastructure issues]
</review_summary>

<files_reviewed>

| File                               | Lines | Review Focus                     |
| ---------------------------------- | ----- | -------------------------------- |
| [/path/to/Dockerfile]              | [X-Y] | Container build, base image      |
| [/path/to/.github/workflows/*.yml] | [X-Y] | CI/CD security, job ordering     |
| [/path/to/deploy/*.yml]            | [X-Y] | Deployment config, health checks |

</files_reviewed>

<security_audit>

## Infrastructure Security Review

### Secret Management

- [ ] No hardcoded secrets, tokens, API keys, or passwords
- [ ] Secrets loaded from environment variables or vault
- [ ] .env files in .gitignore
- [ ] No secrets passed as Docker build args
- [ ] No secrets printed in CI/CD logs
- [ ] Secret rotation strategy documented or automated

### Supply Chain Security

- [ ] CI/CD actions pinned to SHA hashes (not tags)
- [ ] Base images pinned to digest or specific version (not `latest`)
- [ ] Package manager lockfile used (package-lock.json, yarn.lock, etc.)
- [ ] Dependency sources verified (no typosquatting risk)

### Permissions

- [ ] CI/CD permissions use least privilege (`permissions:` block)
- [ ] OIDC used over long-lived credentials where possible
- [ ] Docker container runs as non-root user
- [ ] File permissions minimal (no 777/666)

**Security Issues Found:**

| Finding | Location    | Severity               | Impact                           |
| ------- | ----------- | ---------------------- | -------------------------------- |
| [Issue] | [file:line] | [Critical/High/Medium] | [What an attacker could exploit] |

</security_audit>

<must_fix>

## Critical Issues (Blocks Approval)

### Issue #1: [Descriptive Title]

**Location:** `/path/to/file:45`
**Category:** [Secret Exposure | Supply Chain | Permissions | Container Safety | Deployment Risk]

**Problem:** [What is wrong -- one sentence]

**Current code:**

```yaml
# or Dockerfile, HCL, etc.
# The problematic configuration
```

**Recommended fix:**

```yaml
# The corrected configuration
```

**Impact:** [What breaks or what an attacker can exploit if this is not fixed]

</must_fix>

<should_fix>

## Important Issues (Recommended Before Merge)

### Issue #1: [Title]

**Location:** `/path/to/file:67`
**Category:** [Build Performance | Caching | Image Size | Observability | Reliability]

**Issue:** [What could be better]

**Suggestion:**

```yaml
# How to improve
```

**Benefit:** [Why this helps -- build time, image size, reliability, cost]

</should_fix>

<nice_to_have>

## Minor Suggestions (Optional)

- **[Title]** at `/path:line` - [Brief suggestion with rationale]

</nice_to_have>

<infra_checklist>

## Infrastructure Checklist

### Dockerfile (if applicable)

- [ ] Multi-stage build, layer ordering optimized, .dockerignore complete
- [ ] Non-root USER, HEALTHCHECK, SIGTERM handling, minimal base image
- [ ] Build deps excluded from runtime stage, cache cleaned

### CI/CD Pipeline (if applicable)

- [ ] Actions pinned to SHA, permissions least-privilege, secrets not in logs
- [ ] Job ordering correct (needs:), cache keys include lockfile hash, timeouts set
- [ ] Dependency caching enabled, parallel jobs where possible

### Deployment (if applicable)

- [ ] Readiness and liveness probes, resource limits (CPU/memory), graceful shutdown
- [ ] Rolling update strategy, rollback config, connection draining

**Issues Found:** Dockerfile: [count] | CI/CD: [count] | Deployment: [count]

</infra_checklist>

<convention_check>

## Convention Adherence

| Dimension                     | Status         | Notes                 |
| ----------------------------- | -------------- | --------------------- |
| Secret handling               | PASS/WARN/FAIL | [Details if not PASS] |
| CI/CD action pinning          | PASS/WARN/FAIL | [Details if not PASS] |
| Dockerfile best practices     | PASS/WARN/FAIL | [Details if not PASS] |
| Resource limits               | PASS/WARN/FAIL | [Details if not PASS] |
| Health checks                 | PASS/WARN/FAIL | [Details if not PASS] |
| Environment variable handling | PASS/WARN/FAIL | [Details if not PASS] |

</convention_check>

<positive_feedback>

## What Was Done Well

- [Specific positive observation about infrastructure patterns]
- [Another positive observation with evidence]
- [Reinforces patterns to continue using]

</positive_feedback>

<deferred>

## Deferred to Specialists

**API Reviewer:**

- [Application logic that needs review]

**Web Reviewer:**

- [Frontend code if any]

**AI Reviewer:**

- [AI/ML integration code if any]

</deferred>

<approval_status>

## Final Recommendation

**Decision:** [APPROVE | REQUEST CHANGES | REJECT]

**Blocking Issues:** [count] ([count] security-related)
**Recommended Fixes:** [count]
**Suggestions:** [count]

**Infrastructure Checklist Summary:**

- Security: [PASS/FAIL] ([count] issues)
- Build Efficiency: [PASS/FAIL] ([count] issues)
- Deployment Reliability: [PASS/FAIL] ([count] issues)
- Observability: [PASS/FAIL] ([count] issues)

**Next Steps:**

1. [Action item - e.g., "Pin actions/checkout to SHA at .github/workflows/ci.yml:12"]
2. [Action item]

</approval_status>

</output_format>

---

## Section Guidelines

### Severity Levels (Infrastructure-Specific)

| Level     | Label          | Criteria                                                                   | Blocks Approval? |
| --------- | -------------- | -------------------------------------------------------------------------- | ---------------- |
| Critical  | `Must Fix`     | Secret exposure, supply-chain attack vector, no health checks, no rollback | Yes              |
| Important | `Should Fix`   | Build caching, image size, missing resource limits, observability gaps     | No (recommended) |
| Minor     | `Nice to Have` | Build time optimization, log format, tag conventions                       | No               |

### Issue Categories (Infrastructure-Specific)

| Category              | Examples                                                       |
| --------------------- | -------------------------------------------------------------- |
| **Secret Exposure**   | Hardcoded tokens, secrets in build args, credentials in logs   |
| **Supply Chain**      | Unpinned actions/images, mutable tags, missing lockfiles       |
| **Permissions**       | Overly broad CI/CD permissions, root container, 777 file perms |
| **Container Safety**  | No non-root user, missing HEALTHCHECK, no signal handling      |
| **Build Performance** | No caching, redundant layers, large base images                |
| **Deployment Risk**   | No health checks, no rollback, no resource limits, no drain    |
| **Observability**     | No logging config, missing metrics, no alerting rules          |
| **IaC Patterns**      | State management issues, no drift detection, hardcoded values  |

### Issue Format Requirements

Every issue must include:

1. **Specific file:line location**
2. **Current code/config snippet** (what is wrong)
3. **Fixed code/config snippet** (how to fix)
4. **Impact explanation** (what breaks or what an attacker can exploit)
