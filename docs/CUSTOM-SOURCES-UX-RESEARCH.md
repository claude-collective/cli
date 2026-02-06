# Custom Sources UX Research

Research into UX patterns for managing custom skill sources in the CLI.

## Context

The CLI currently has:
- `cc import skill github:owner/repo --list` to import skills from third-party repos
- Single `source` config (global/project) for the primary skills marketplace
- `agents_source` config for remote agent definitions

The user wants to explore adding **persistent custom sources** that users can configure and browse from when searching or importing skills.

---

## 1. Patterns from Other Tools

### 1.1 npm (Custom Registries)

**Configuration approach:**
```bash
# Global config
npm config set registry https://registry.company.com

# Per-project (.npmrc)
registry=https://registry.company.com

# Scoped registries
@myorg:registry=https://npm.myorg.com
```

**UX patterns:**
- Single primary registry (not multiple)
- Scope-based routing (`@org/package` -> specific registry)
- Fallback to default registry
- Config in `.npmrc` file (flat key=value format)

**Relevant takeaways:**
- Scoped sources are powerful for organization separation
- Simple flat config files work well
- Single primary source with optional scopes

---

### 1.2 pip (Extra Index URLs)

**Configuration approach:**
```bash
# CLI flags
pip install --index-url https://private.pypi.org/simple/
pip install --extra-index-url https://private.pypi.org/simple/

# pip.conf
[global]
index-url = https://private.pypi.org/simple/
extra-index-url = https://pypi.org/simple/

# Per-project (pyproject.toml)
[[tool.pip.sources]]
name = "private"
url = "https://private.pypi.org/simple/"
```

**UX patterns:**
- Primary index + extra indexes
- CLI flag overrides config
- Named sources in newer tooling (Poetry, PDM)
- Search checks all sources in order

**Relevant takeaways:**
- "Extra" sources concept is intuitive
- Named sources with URLs improve UX over raw URLs everywhere
- Priority/ordering matters for search

---

### 1.3 Homebrew (Taps)

**Configuration approach:**
```bash
# Add a tap (persistent)
brew tap user/repo

# Install from tap
brew install user/repo/formula

# List taps
brew tap

# Remove tap
brew untap user/repo

# Search across all taps
brew search term
```

**UX patterns:**
- `tap` command to add persistent sources
- Implicit GitHub prefix (`user/repo` = `github.com/user/homebrew-repo`)
- Unified search across core + all taps
- Tap name used as prefix when conflicts exist
- Taps stored in ~/.homebrew/Library/Taps/

**Relevant takeaways:**
- "tap" metaphor is memorable
- Implicit GitHub handling reduces friction
- Unified search is critical UX
- Source name as disambiguation prefix

---

### 1.4 Cargo (Registries) - Rust

**Configuration approach:**
```toml
# .cargo/config.toml
[registries]
my-registry = { index = "https://my-registry.example.com" }

[registry]
default = "my-registry"

# Cargo.toml (per-dependency)
[dependencies]
my-package = { version = "1.0", registry = "my-registry" }
```

**UX patterns:**
- Named registries defined once
- Default registry configurable
- Per-dependency registry override
- CLI: `cargo search --registry=my-registry term`

**Relevant takeaways:**
- Named registries with one definition, many uses
- Per-item source override is powerful
- Registry flag on commands for explicit source selection

---

### 1.5 Go Modules (GOPROXY)

**Configuration approach:**
```bash
# Comma-separated proxy list
export GOPROXY="https://proxy.company.com,https://proxy.golang.org,direct"

# Per-module (go.mod)
# Uses replace directive for overrides
replace example.com/old => example.com/new v1.0.0
```

**UX patterns:**
- Ordered list of sources to try
- "direct" keyword means "fetch from source"
- Fallback chain: try source1, if 404 try source2, etc.
- Environment variable based

**Relevant takeaways:**
- Ordered fallback is a good UX pattern
- "direct" concept useful for development

---

## 2. Configuration Location Analysis

### Current CLI Config Locations

| Config Type | Location | Purpose |
|-------------|----------|---------|
| Global | `~/.claude-collective/config.yaml` | User-wide defaults |
| Project | `.claude-src/config.yaml` | Project-specific settings |
| Project (legacy) | `.claude/config.yaml` | Legacy location |

### Options for Custom Sources

#### Option A: Global Only

```yaml
# ~/.claude-collective/config.yaml
source: github:claude-collective/skills  # primary
extra_sources:
  - name: company
    url: github:mycompany/skills
  - name: team
    url: github:myteam/custom-skills
```

**Pros:**
- Simple - one place to configure
- User's sources follow them across projects

**Cons:**
- Can't have project-specific sources
- Team sharing requires out-of-band communication

---

#### Option B: Project Only

```yaml
# .claude-src/config.yaml
source: github:claude-collective/skills
extra_sources:
  - name: company
    url: github:mycompany/skills
```

**Pros:**
- Sources committed with project
- Team sharing via version control

**Cons:**
- Repetitive across projects
- Can't easily add personal sources

---

#### Option C: Both with Merge (Recommended)

```yaml
# ~/.claude-collective/config.yaml (global)
extra_sources:
  - name: personal
    url: github:myname/my-skills

# .claude-src/config.yaml (project)
source: github:claude-collective/skills
extra_sources:
  - name: company
    url: github:mycompany/skills
```

**Resolution order:**
1. Project sources (highest priority)
2. Global extra sources
3. Primary source (from project, env, global, or default)

**Pros:**
- Flexible - personal + team sources
- Project sources version controlled
- Matches existing config precedence pattern

**Cons:**
- More complex mental model
- Potential naming conflicts (solvable with warning)

---

## 3. UX Pattern Recommendations

### 3.1 Command Structure

Based on Homebrew's tap pattern (most intuitive for this use case):

```bash
# Add a source
cc sources add github:company/skills --name company
cc sources add github:owner/repo            # auto-names from repo

# List configured sources
cc sources list
cc sources ls

# Remove a source
cc sources remove company
cc sources rm company

# Set/unset default source
cc sources set-default company

# Show source details
cc sources info company

# Refresh source cache
cc sources refresh company
cc sources refresh --all
```

**Why "sources" over "taps" or "registries":**
- "Sources" aligns with existing `--source` flag terminology
- More intuitive than "tap" for non-Homebrew users
- Less formal than "registry" which implies infrastructure

---

### 3.2 Search/Browse Integration

**Unified search (recommended):**
```bash
# Search all sources
cc search react
# Output shows source:
#   react (@vince) - claude-collective
#   react-patterns - company
#   react-hooks - personal

# Search specific source
cc search react --source company

# Filter by source
cc search react --sources company,personal
```

**List with source filter:**
```bash
# List skills from all sources
cc list --skills

# List skills from specific source
cc list --skills --source company
```

---

### 3.3 Import Integration

**Current (works well):**
```bash
cc import skill github:owner/repo --skill react-patterns
```

**With sources (cleaner for repeated use):**
```bash
# After: cc sources add github:owner/repo --name team
cc import skill team:react-patterns
cc import skill team --list
cc import skill team --all
```

**Disambiguation when skill exists in multiple sources:**
```bash
cc import skill react-patterns
# Error: 'react-patterns' found in multiple sources:
#   - company: github:company/skills
#   - team: github:team/skills
# Use: cc import skill company:react-patterns

# Or with explicit source
cc import skill react-patterns --from company
```

---

### 3.4 Config File Examples

**Global config with extra sources:**
```yaml
# ~/.claude-collective/config.yaml
author: "@myhandle"

# Personal extra sources (available in all projects)
extra_sources:
  - name: personal
    url: github:myname/claude-skills
    description: My custom skills

  - name: work
    url: github:mycompany/skills
    auth_required: true  # hint that GIGET_AUTH needed
```

**Project config with sources:**
```yaml
# .claude-src/config.yaml
source: github:claude-collective/skills

# Team sources (version controlled with project)
extra_sources:
  - name: team
    url: github:team/shared-skills
    refresh: daily  # optional: auto-refresh hint

  - name: vendor
    url: github:vendor/sdk-skills
    ref: v2.0.0  # pin to specific ref
```

**Combined effective sources (what cc sources list shows):**
```
Primary Sources:
  default    github:claude-collective/skills  (project config)

Extra Sources:
  team       github:team/shared-skills        (project)
  vendor     github:vendor/sdk-skills@v2.0.0  (project)
  personal   github:myname/claude-skills      (global)
  work       github:mycompany/skills          (global)
```

---

### 3.5 Source Reference Syntax

**Supported formats (leverage existing parsing):**
```
github:owner/repo           # GitHub shorthand
gh:owner/repo               # GitHub shorthand (alt)
https://github.com/o/r      # Full URL
owner/repo                  # Assumed GitHub
/local/path                 # Local directory
./relative/path             # Relative path
```

**With ref pinning:**
```
github:owner/repo#branch
github:owner/repo#v1.0.0
github:owner/repo#abc123
```

---

## 4. Recommended Implementation

### Phase 1: Basic Source Management

**New commands:**
```bash
cc sources add <url> [--name <name>] [--global]
cc sources list
cc sources remove <name> [--global]
```

**Config schema addition:**
```typescript
interface SourceEntry {
  name: string;
  url: string;
  description?: string;
  ref?: string;  // optional: pin to branch/tag/commit
}

interface GlobalConfig {
  source?: string;
  author?: string;
  marketplace?: string;
  agents_source?: string;
  extra_sources?: SourceEntry[];  // NEW
}

interface ProjectConfig {
  source?: string;
  author?: string;
  marketplace?: string;
  agents_source?: string;
  extra_sources?: SourceEntry[];  // NEW
}
```

---

### Phase 2: Search Integration

**Update search to query all sources:**
```bash
cc search react
# Searches: primary source + all extra_sources
# Displays source name in results
```

**Add source filter:**
```bash
cc search react --source team
cc search react --sources team,personal
```

---

### Phase 3: Import Integration

**Shorthand syntax:**
```bash
cc import skill team:react-patterns
# Equivalent to: cc import skill github:team/shared-skills --skill react-patterns
```

---

## 5. Mock CLI Flows

### Adding a Source

```
$ cc sources add github:company/skills --name company

Adding source...
  Name:   company
  URL:    github:company/skills
  Scope:  project

Fetching source to verify...
  Found 12 skills in 'skills/' directory

Source 'company' added successfully.
  Config: .claude-src/config.yaml

Use 'cc search --source company' to browse skills.
Use 'cc import skill company:skill-name' to import.
```

### Listing Sources

```
$ cc sources list

Sources (5 total)

PRIMARY
  default         github:claude-collective/skills          (project config)

PROJECT SOURCES (.claude-src/config.yaml)
  team            github:team/shared-skills                (12 skills)
  vendor          github:vendor/sdk-skills@v2.0.0          (4 skills)

GLOBAL SOURCES (~/.claude-collective/config.yaml)
  personal        github:myname/claude-skills              (8 skills)
  work            github:mycompany/skills                  (not fetched)

Total: 24+ skills available
```

### Search Across Sources

```
$ cc search react

Search results for "react" (4 matches)

  react (@vince)                    claude-collective
    React patterns and best practices

  react-query-patterns              team
    React Query usage patterns for our APIs

  react-testing                     personal
    My testing patterns for React

  vendor-react-components           vendor
    Vendor SDK React component patterns

Use 'cc info <skill>' for details.
Use 'cc import skill <source>:<skill>' to import.
```

### Import with Source Prefix

```
$ cc import skill team:react-query-patterns

Import Skill from 'team' source

Source: github:team/shared-skills
Skill:  react-query-patterns

Importing...
  Copied to .claude/skills/react-query-patterns/
  Added forked_from metadata

Success! Imported 'react-query-patterns' from team.

Run 'cc compile' to include in your agents.
```

---

## 6. Open Questions

### Resolved by This Research

1. **Command naming?** -> `cc sources` (aligns with existing `--source` terminology)
2. **Config location?** -> Both global and project, with merge
3. **Search behavior?** -> Unified by default, with filter flag

### Needs Future Discussion

1. **Source authentication** - How to handle private repos across sources?
   - Current: `GIGET_AUTH` env var works globally
   - Future: Per-source auth config?

2. **Source versioning** - Should sources track their own version?
   - Use case: "team skills v2 requires CC v0.12+"
   - Could warn on version mismatch

3. **Source priority** - When same skill exists in multiple sources, which wins?
   - Option A: First match wins (based on source order)
   - Option B: Always prompt user to choose
   - Option C: Project sources > Global sources > Primary

4. **Auto-refresh** - Should sources auto-refresh?
   - Current: Cache until `--refresh` flag used
   - Future: Configurable TTL per source?

---

## 7. Summary

### Recommended Approach

1. **Command:** `cc sources add|list|remove` (tap-like simplicity)
2. **Config:** Both global and project with merge strategy
3. **Search:** Unified by default, show source in results
4. **Import:** Support `source:skill` shorthand syntax
5. **Naming:** Use "sources" to align with existing `--source` flag

### Key UX Principles

- **Minimal friction** - Adding a source should be one command
- **Unified experience** - Search/browse works across all sources
- **Explicit when ambiguous** - Require source prefix for conflicts
- **Progressive disclosure** - Simple use cases stay simple

### Files to Modify for Implementation

| File | Changes |
|------|---------|
| `/src/cli/lib/config.ts` | Add `extra_sources` to interfaces |
| `/src/cli/commands/sources/add.ts` | New command |
| `/src/cli/commands/sources/list.ts` | New command |
| `/src/cli/commands/sources/remove.ts` | New command |
| `/src/cli/commands/search.ts` | Add multi-source support |
| `/src/cli/commands/import/skill.ts` | Add source prefix parsing |
| `/docs/commands.md` | Document new commands |
