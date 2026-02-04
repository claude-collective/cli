# Phase 7A Pre-Implementation Test Plan

**Purpose:** Validate the current CLI works correctly with nextjs-fullstack before making Phase 7A changes.

**Test Directory:** `/home/vince/dev/cv-launch`
**CLI Command:** `bun run /home/vince/dev/cli/src/cli/index.ts`

---

## Recent Updates (2026-02-01)

### Auto-Detection of Installation Mode

The CLI now **automatically detects** whether you have a local or plugin mode installation:

- **Local mode**: `.claude/config.yaml` exists in project directory
- **Plugin mode**: `.claude/plugins/claude-collective/` exists

**Key improvements:**

- `cc compile` - No `--output` flag needed for local mode (auto-detected)
- `cc list` - Shows info for both local and plugin modes
- `cc edit` - Works with both installation modes
- New `installMode` property in `config.yaml` explicitly stores the mode

---

## Test Setup

### 1. Backup Current State

```bash
# Create backup of current .claude directory
cd /home/vince/dev/cv-launch
cp -r .claude .claude-backup-$(date +%Y%m%d-%H%M%S)
```

### 2. Clean State (for fresh tests)

```bash
# Remove existing installation
rm -rf /home/vince/dev/cv-launch/.claude
```

---

## Test Cases

### Test 1: Fresh Init with nextjs-fullstack (Local Mode)

**Command:**

```bash
cd /home/vince/dev/cv-launch
bun run /home/vince/dev/cli/src/cli/index.ts init
```

**Interactive Steps:**

1. Select "Use a pre-built stack template"
2. Select "nextjs-fullstack"
3. At approach screen, ensure "Install Mode: Local" (toggle if needed)
4. Continue to confirm
5. Confirm installation

**Expected Output:**

- `.claude/config.yaml` created with `installMode: local`
- `.claude/agents/` directory with 18 agent markdown files
- `.claude/skills/` directory with 30+ skill directories

**Validation Checklist:**

- [ ] `config.yaml` has `name: claude-collective`
- [ ] `config.yaml` has `installMode: local`
- [ ] `config.yaml` lists React skill: `web/framework/react (@vince)`
- [ ] `config.yaml` lists agents including `web-developer`, `api-developer`
- [ ] `.claude/agents/web-developer.md` exists and contains React references
- [ ] `.claude/skills/react/` directory exists with SKILL.md

---

### Test 2: List (Show Current Installation)

**Prerequisite:** Test 1 completed successfully

**Command:**

```bash
cd /home/vince/dev/cv-launch
bun run /home/vince/dev/cli/src/cli/index.ts list
```

**Expected Output:**

```
Installation: claude-collective (local mode)
  Mode:    Local
  Skills:  35
  Agents:  18
  Config:  /home/vince/dev/cv-launch/.claude/config.yaml
  Agents:  /home/vince/dev/cv-launch/.claude/agents
```

**Validation:**

- [ ] Output shows "Mode: Local"
- [ ] Output shows correct skill count (30+)
- [ ] Output shows correct agent count (14+)

---

### Test 3: Compile (Auto-Detects Local Mode)

**Prerequisite:** Test 1 completed successfully (local mode installed)

**Command:**

```bash
cd /home/vince/dev/cv-launch
bun run /home/vince/dev/cli/src/cli/index.ts compile
```

**Expected Output:**

```
Local Mode Compile (auto-detected)

Custom Output Compile

Output directory: /home/vince/dev/cv-launch/.claude/agents

Discovering skills...
Discovered 35 local skills
...
```

**Note:** The CLI auto-detects local mode from `config.yaml`. No `--output` flag needed!

**Validation:**

- [ ] Output shows "Local Mode Compile (auto-detected)"
- [ ] All agent files have recent modification time
- [ ] No errors during compilation

---

### Test 4: Doctor (Health Check)

**Prerequisite:** Test 1 completed successfully

**Command:**

```bash
cd /home/vince/dev/cv-launch
bun run /home/vince/dev/cli/src/cli/index.ts doctor
```

**Expected Output:**

- Health check results
- All checks should pass for a fresh installation

**Validation:**

- [ ] Config Valid: ✓
- [ ] Skills Resolved: ✓
- [ ] Agents Compiled: ✓
- [ ] No errors reported

---

### Test 5: Eject Skills

**Prerequisite:** Test 1 completed successfully

**Command:**

```bash
cd /home/vince/dev/cv-launch
bun run /home/vince/dev/cli/src/cli/index.ts eject skills
```

**Expected Output:**

- Skills copied to local directory
- Message about ejected skills

**Validation:**

- [ ] Skills now editable locally
- [ ] Skill files present in expected location

---

### Test 6: Eject Agents

**Prerequisite:** Test 1 completed successfully

**Command:**

```bash
cd /home/vince/dev/cv-launch
bun run /home/vince/dev/cli/src/cli/index.ts eject agents
```

**Expected Output:**

- Agent partials copied to `.claude/agents/_partials/`
- Message about ejected agents

**Validation:**

- [ ] `.claude/agents/_partials/` directory created
- [ ] Contains subdirectories for each agent with `intro.md`, `workflow.md`, etc.

---

### Test 7: Eject Templates

**Prerequisite:** Test 1 completed successfully

**Command:**

```bash
cd /home/vince/dev/cv-launch
bun run /home/vince/dev/cli/src/cli/index.ts eject templates
```

**Expected Output:**

- Templates copied to `.claude/templates/`
- Message about ejected templates

**Validation:**

- [ ] `.claude/templates/` directory created
- [ ] Contains `agent.liquid` or similar template files

---

### Test 8: Edit (Modify Installation)

**Prerequisite:** Test 1 completed successfully

**Command:**

```bash
cd /home/vince/dev/cv-launch
bun run /home/vince/dev/cli/src/cli/index.ts edit
```

**Interactive Steps:**

1. Wizard opens with current selections pre-loaded
2. Navigate to a category and add/remove a skill
3. Confirm changes

**Expected Output:**

- Config updated with new selections
- Agents recompiled

**Validation:**

- [ ] `config.yaml` reflects changes
- [ ] Agent files updated

---

### Test 9: Uninstall

**Command:**

```bash
cd /home/vince/dev/cv-launch
bun run /home/vince/dev/cli/src/cli/index.ts uninstall
```

**Interactive Steps:**

1. Confirm uninstall when prompted

**Expected Output:**

- `.claude/` directory removed
- Success message displayed

**Validation:**

- [ ] `/home/vince/dev/cv-launch/.claude/` no longer exists

---

### Test 10: Fresh Init with nextjs-fullstack (Plugin Mode)

**Command:**

```bash
cd /home/vince/dev/cv-launch
bun run /home/vince/dev/cli/src/cli/index.ts init
```

**Interactive Steps:**

1. Select "Use a pre-built stack template"
2. Select "nextjs-fullstack"
3. Toggle "Install Mode" to "Plugin"
4. Continue to confirm
5. Confirm installation

**Expected Output:**

- Plugin directory created at `.claude/plugins/claude-collective/`
- `config.yaml` with `installMode: plugin`

**Validation:**

- [ ] `.claude/plugins/claude-collective/` exists
- [ ] Plugin contains agents and skills subdirectories

---

## Quick Validation Script

Run the automated test script:

```bash
./scripts/phase7a-pre-test.sh
```

This script:

1. Backs up existing installation
2. Runs non-interactive tests (CLI availability, error handling)
3. Provides instructions for interactive tests

---

## Expected Files After Fresh Init (nextjs-fullstack, Local Mode)

### config.yaml should contain:

```yaml
name: claude-collective
version: 1.0.0
installMode: local # ← NEW: Explicitly stores installation mode
skills:
  - id: meta/methodology/anti-over-engineering (@vince)
  - id: meta/methodology/investigation-requirements (@vince)
  # ... more methodology skills
  - id: web/framework/react (@vince) # ← KEY: Should be React
  - id: web/styling/scss-modules (@vince)
  - id: web/state/zustand (@vince)
  - id: api/framework/hono (@vince)
  - id: api/database/drizzle (@vince)
  # ... more skills
agents:
  - web-developer
  - api-developer
  - web-architecture
  - web-reviewer
  - api-reviewer
  # ... more agents
philosophy: Ship fast, iterate faster
```

### .claude/agents/ should contain:

```
agent-summoner.md
api-developer.md
api-researcher.md
api-reviewer.md
cli-developer.md
cli-reviewer.md
documentor.md
pattern-scout.md
skill-summoner.md
web-architecture.md
web-developer.md
web-pattern-critique.md
web-pm.md
web-researcher.md
web-reviewer.md
web-tester.md
```

### .claude/skills/ should contain directories like:

```
react/
scss-modules/
zustand/
react-query/
hono/
drizzle/
better-auth/
vitest/
msw/
... (30+ total)
```

---

## Quick Validation Commands

After running `cc init` with nextjs-fullstack:

```bash
# Check config exists and has installMode
grep -q "installMode: local" /home/vince/dev/cv-launch/.claude/config.yaml && echo "✓ installMode: local present" || echo "✗ installMode missing"

# Check config has React
grep -q "web/framework/react" /home/vince/dev/cv-launch/.claude/config.yaml && echo "✓ React skill present" || echo "✗ React skill missing"

# Count agents
echo "Agents: $(ls /home/vince/dev/cv-launch/.claude/agents/*.md 2>/dev/null | wc -l)"

# Count skills
echo "Skills: $(ls -d /home/vince/dev/cv-launch/.claude/skills/*/ 2>/dev/null | wc -l)"

# Check web-developer agent mentions React
grep -q "React" /home/vince/dev/cv-launch/.claude/agents/web-developer.md && echo "✓ web-developer.md mentions React" || echo "✗ web-developer.md missing React"

# Test auto-detection
cd /home/vince/dev/cv-launch
bun run /home/vince/dev/cli/src/cli/index.ts compile --dry-run
# Should show: "Local Mode Compile (auto-detected)"
```

---

## Post-Test Cleanup

```bash
# Remove test installation
rm -rf /home/vince/dev/cv-launch/.claude

# Restore backup (if needed)
# cp -r /home/vince/dev/cv-launch/.claude-backup-YYYYMMDD-HHMMSS /home/vince/dev/cv-launch/.claude
```

---

## Command Reference

| Command        | Local Mode        | Plugin Mode | Notes                       |
| -------------- | ----------------- | ----------- | --------------------------- |
| `cc init`      | ✓                 | ✓           | Wizard lets you choose mode |
| `cc compile`   | ✓ (auto-detected) | ✓           | No flags needed             |
| `cc list`      | ✓                 | ✓           | Shows mode in output        |
| `cc doctor`    | ✓                 | ✓           | Checks installation health  |
| `cc eject`     | ✓                 | ✓           | Defaults to `.claude/`      |
| `cc edit`      | ✓                 | ✓           | Auto-detects mode           |
| `cc uninstall` | ✓                 | ✓           | Removes installation        |
