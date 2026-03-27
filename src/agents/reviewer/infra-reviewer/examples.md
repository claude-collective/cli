## Example Review Output

````markdown
# Infrastructure Review: CI/CD Pipeline and Dockerfile Updates

**Files Reviewed:** 4 files (170 lines)
**Overall Assessment:** REQUEST CHANGES
**Key Findings:** 2 critical security issues: unpinned GitHub Actions and secrets exposed in build args. 1 important Dockerfile optimization: layer ordering prevents cache reuse on dependency changes.

## Infrastructure Security Review

### Secret Management

- [x] No hardcoded secrets, tokens, API keys, or passwords
- [ ] No secrets passed as Docker build args -- FAIL (deploy.yml:28)
- [x] .env files in .gitignore

### Supply Chain Security

- [ ] CI/CD actions pinned to SHA hashes -- FAIL (deploy.yml:12)
- [x] Package manager lockfile used
- [x] Base image pinned to specific version

### Permissions

- [x] Docker container runs as non-root user
- [x] CI/CD permissions use least privilege

## Must Fix

**Issue #1: Unpinned GitHub Actions (Supply Chain Attack Vector)**

- Location: `.github/workflows/deploy.yml:12`
- Category: Supply Chain
- Problem: Actions referenced by mutable tag, vulnerable to supply-chain injection
- Current:
  ```yaml
  - uses: actions/checkout@v4
  - uses: docker/build-push-action@v5
  ```
- Fix:
  ```yaml
  - uses: actions/checkout@b4ffde65f46336ab88eb53be808477a3936bae11 # v4.1.1
  - uses: docker/build-push-action@4a13e500e55cf31b7a5d59a38ab2040ab0f42f56 # v5.1.0
  ```
- Impact: A compromised action tag silently runs malicious code in your CI with full repo access.

**Issue #2: Database Password in Docker Build Arg**

- Location: `.github/workflows/deploy.yml:28`
- Category: Secret Exposure
- Problem: Secret passed as build arg, visible in image layer history via `docker history`
- Current:
  ```yaml
  build-args: |
    DB_PASSWORD=${{ secrets.DB_PASSWORD }}
  ```
- Fix: Use runtime environment variables instead of build args for secrets:
  ```yaml
  # Remove from build-args. Pass at runtime:
  # docker run -e DB_PASSWORD=$DB_PASSWORD ...
  ```
- Impact: Anyone with image pull access can extract the database password from image layers.

## Should Fix

**Dockerfile Layer Ordering**

- Location: `Dockerfile:8-12`
- Category: Build Performance
- Issue: Source code copied before dependency install, invalidating npm cache on every code change
- Current:
  ```dockerfile
  COPY . .
  RUN npm ci
  ```
- Suggestion:
  ```dockerfile
  COPY package.json package-lock.json ./
  RUN npm ci
  COPY . .
  ```
- Benefit: Dependency layer cached until lockfile changes. Saves 30-90s per build.

**Missing Resource Limits in Compose**

- Location: `docker-compose.prod.yml:15`
- Category: Deployment Risk
- Issue: No memory or CPU limits, container can consume all host resources
- Suggestion:
  ```yaml
  deploy:
    resources:
      limits:
        cpus: "2.0"
        memory: 512M
  ```
- Benefit: Prevents a single container from destabilizing the host.

## Nice to Have

- **HEALTHCHECK in Dockerfile** at `Dockerfile:42` - Add health check for orchestrator integration (use wget or a dedicated binary if curl is unavailable in minimal images)
- **Concurrency group** at `.github/workflows/deploy.yml:1` - Add `concurrency: { group: deploy-${{ github.ref }}, cancel-in-progress: true }` to prevent duplicate deploys

## Infrastructure Checklist

- Dockerfile: 1 issue (layer ordering)
- CI/CD: 2 issues (unpinned actions, secret in build arg)
- Deployment: 1 issue (missing resource limits)

## Positive Observations

- Multi-stage Dockerfile correctly separates build and runtime stages
- Non-root USER configured in runtime stage
- `.dockerignore` covers node_modules and .git

## Verdict: REQUEST CHANGES

**Blocking Issues:** 2 (2 security-related)
**Recommended Fixes:** 2

Fix 2 blocking security issues (unpinned actions, secret in build arg) before merge.
````
