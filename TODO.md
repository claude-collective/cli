# Claude Collective CLI - Task Tracking

## Current Focus

Phase 7B complete. Ready for user testing.

For completed tasks, see [TODO-completed.md](./TODO-completed.md).
For deferred tasks, see [TODO-deferred.md](./TODO-deferred.md).
For wizard architecture details, see [docs/wizard-index.md](./docs/wizard-index.md).

---

## Blockers

_None currently. Add serious blockers here immediately when discovered._

---

## Reminders for Agents

### R1: Use Specialized Agents

- **CLI Developer** (`cli-developer`) - All feature implementation work
- **CLI Tester** (`web-tester`) - All test writing
- **API Researcher** (`api-researcher`) - Backend/resolver research
- **Web Researcher** (`web-researcher`) - Frontend/component research

Do NOT implement features or write tests directly. Always delegate to the appropriate agent.

### R2: Handle Uncertainties

When encountering unknowns or uncertainties:

1. Spawn research subagents to investigate
2. Use CLI Developer to prototype if needed
3. **Create TODO tasks in this file** with findings
4. Document decisions in appropriate docs/ file

### R3: Blockers Go to Top

If a serious blocker is discovered, add it to the **Blockers** section at the top of this file immediately. Do not continue work that depends on the blocked item.

### R4: Do NOT Commit

**Keep all changes uncommitted.** The user will handle committing when ready.

### R5: Move Completed Tasks to Archive

Once a task is done, move it to [TODO-completed.md](./TODO-completed.md).

### R6: Update Task Status

When starting a task: `[IN PROGRESS]`. When completing: `[DONE]`.

**IMPORTANT:** Sub-agents MUST update this TODO.md file when starting and completing subtasks.

### R7: Compact at 70% Context

When context usage reaches 70%, run `/compact`.

### R8: Cross-Repository Changes Allowed

You may make changes in the claude-subagents directory (`/home/vince/dev/claude-subagents`) as well, if needed. This is the source marketplace for skills and agents.

---

## Active Tasks

### Agent Architecture Alignment (Post-Research)

Based on research findings from agent-summoner-research-findings.md:

#### T1: Review Agent Definitions for Alignment
- [ ] Comb through all agent definitions in `src/agents/`
- [ ] Verify YAML configs match documented schema
- [ ] Fix outdated references (e.g., `tester-agent` → `web-tester/cli-tester`)
- [ ] Add missing agents to documentation (e.g., `cli-migrator`)
- [ ] Update agent descriptions that reference non-existent agents

#### T2: Generalize Agent Specificity
- [ ] Review agents for over-specific technology references
- [ ] Frontend agents should mention "styling" not "CSS/SCSS"
- [ ] Backend agents should mention "database" not specific ORMs
- [ ] Ensure agents focus on patterns, not implementations
- [ ] Keep technology details in SKILLS, not agent prompts

#### T3: Align Claude Subagents Documentation
- [ ] Review `.claude/agents/` compiled bibles
- [ ] Remove references to non-existent files (`CLAUDE_ARCHITECTURE_BIBLE.md`, `PROMPT_BIBLE.md`)
- [ ] Update `src/stacks/` references (directory doesn't exist)
- [ ] Fix skills architecture documentation (`.claude/skills/` is directories, not files)
- [ ] Ensure compiled bibles match actual codebase structure

#### T4: Update Agent-Summoner and Skill-Summoner
- [ ] Fix agent-summoner to reference correct architecture
- [ ] Remove references to non-existent `src/docs/` files
- [ ] Update skill creation workflow for directory-based skills
- [ ] Align naming convention documentation with actual `{domain}-{subcategory}-{technology}` pattern
- [ ] Re-run agent-summoner on itself for self-improvement

#### T5: Create Work-Related Agents and Skills
- [ ] Identify gaps in current agent ecosystem for work use cases
- [ ] Create specialized agents for common work patterns
- [ ] Create skills for work-specific technologies
- [ ] Ensure new agents follow corrected architecture patterns

### Bible Documentation Updates

#### T6: Bible Path References [DONE]
- [x] Fix INDEX.md bible paths (`src/docs/` → `docs/bibles/`)
- [x] Fix agent names in INDEX.md (frontend→web, backend→api, add cli variants)
- [x] Add migration agent category
- [x] Mark missing plugin docs as TODO

#### T7: SKILL-ATOMICITY-BIBLE Updates [DONE]
- [x] Add skill directory structure section
- [x] Document examples/ folder pattern with separate files
- [x] Add TOC guidance for SKILL.md files

#### T8: Convert Bibles to Skills [RESEARCH COMPLETE]
Research findings: Converting Bibles to skills is **technically possible but strategically problematic**.

**Recommendation:** Keep Bibles as standalone reference documents. Create complementary **narrow reference skills** for specific use cases instead.

**Rationale:**
- Bibles serve as comprehensive reference docs (500-1000+ lines)
- Skills should be atomic, focused (atomicity principle)
- Converting would violate skill atomicity and bloat context
- Better approach: create small "reference skills" that link to relevant bible sections

**Alternative Implementation (if desired):**
- `meta-reference-architecture` - Quick patterns from ARCHITECTURE_BIBLE
- `meta-reference-prompts` - Essential techniques from PROMPT_BIBLE
- Keep full Bibles as docs/ references for deep dives

#### T9: Update Skill-Summoner Documentation
- [ ] Fix `src/skills/` → `.claude/skills/` path references
- [ ] Document 3-part naming pattern `{domain}-{subcategory}-{technology}`
- [ ] Document examples/ folder structure (not single file)
- [ ] Add TOC guidance to skill creation workflow

---

## Notes

- Test target directory: `/home/vince/dev/cv-launch`
- Source marketplace: `/home/vince/dev/claude-subagents`
- CLI under test: `/home/vince/dev/cli`
