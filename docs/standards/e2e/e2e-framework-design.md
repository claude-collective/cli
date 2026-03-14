# E2E Plugin Test Framework: Implementation-Ready Architecture

**Date:** 2026-03-13
**Status:** Architecture specification. Every claim is backed by a file:line reference.

---

## 1. Shared Marketplace Fixture Architecture

### 1.1 What the Shared Marketplace Contains

The E2E source created by `createE2ESource()` (`e2e/helpers/create-e2e-source.ts:176`) contains exactly 10 skills:

| Skill ID                                      | Category             | Domain   | Slug                         |
| --------------------------------------------- | -------------------- | -------- | ---------------------------- |
| `web-framework-react`                         | `web-framework`      | `web`    | `react`                      |
| `web-testing-vitest`                          | `web-testing`        | `web`    | `vitest`                     |
| `web-state-zustand`                           | `web-client-state`   | `web`    | `zustand`                    |
| `api-framework-hono`                          | `api-api`            | `api`    | `hono`                       |
| `meta-methodology-anti-over-engineering`      | `shared-methodology` | `shared` | `anti-over-engineering`      |
| `meta-methodology-context-management`         | `shared-methodology` | `shared` | `context-management`         |
| `meta-methodology-improvement-protocol`       | `shared-methodology` | `shared` | `improvement-protocol`       |
| `meta-methodology-investigation-requirements` | `shared-methodology` | `shared` | `investigation-requirements` |
| `meta-methodology-success-criteria`           | `shared-methodology` | `shared` | `success-criteria`           |
| `meta-methodology-write-verification`         | `shared-methodology` | `shared` | `write-verification`         |

Plus 2 agents (`web-developer`, `api-developer`) and 1 stack (`e2e-test-stack`). Defined at `create-e2e-source.ts:34-138`.

### 1.2 How the Marketplace Is Built

The build chain involves two separate commands:

**Step 1: Build individual skill plugins**

```
build plugins --skills-dir <sourceDir>/src/skills --output-dir <sourceDir>/dist/plugins
```

This command (`src/cli/commands/build/plugins.ts:16`) calls `compileAllSkillPlugins()` (`src/cli/lib/skills/skill-plugin-compiler.ts:197`), which:

- Scans `<skillsDir>/**/<STANDARD_FILES.SKILL_MD>` for skill folders
- For each skill: reads SKILL.md frontmatter via `parseFrontmatter()`, reads `metadata.yaml`, copies SKILL.md + content files to `<outputDir>/<skillName>/skills/<skillName>/`
- Writes `.claude-plugin/plugin.json` manifest per skill via `writePluginManifest()`
- Creates `README.md` per skill

Output structure per skill:

```
dist/plugins/
  web-framework-react/
    .claude-plugin/
      plugin.json          # PluginManifest: { name, version, description, ... }
    skills/
      web-framework-react/
        SKILL.md
        metadata.yaml      # (if exists in source)
    README.md
  web-testing-vitest/
    ...
```

The `build plugins` command accepts these flags (`plugins.ts:30-54`):

- `--skills-dir` / `-s`: Skills source directory (default: `src/skills`)
- `--output-dir` / `-o`: Output directory (default: `dist/plugins`)
- `--skill`: Compile only a specific skill
- `--agents-dir` / `-a`: Also compile agents
- `--verbose` / `-v`

**Step 2: Build marketplace.json**

```
build marketplace --plugins-dir <sourceDir>/dist/plugins --name <marketplaceName>
```

This command (`src/cli/commands/build/marketplace.ts:25`) calls `generateMarketplace()` (`src/cli/lib/marketplace-generator.ts:90`), which:

- Scans `<pluginsDir>/**/.claude-plugin/plugin.json` for plugin manifests
- Infers category from plugin name prefix (e.g., `web-*` -> `"web"`, `api-*` -> `"api"`, `meta-*` -> `"methodology"`) per `CATEGORY_PATTERNS` (`marketplace-generator.ts:27-35`)
- Sorts plugins alphabetically, writes to output path

The `build marketplace` command accepts these flags (`marketplace.ts:38-75`):

- `--plugins-dir` / `-p`: Plugins directory (default: `dist/plugins`)
- `--output` / `-o`: Output file (default: `.claude-plugin/marketplace.json`)
- `--name`: Marketplace name (default: `"agents-inc"`)
- `--version`: Marketplace version (default: `"1.0.0"`)
- `--description`: Marketplace description
- `--owner-name`: Owner name (default: `DEFAULT_BRANDING.NAME`)
- `--owner-email`: Owner email
- `--verbose` / `-v`

### 1.3 What `marketplace.json` Looks Like

Based on the `marketplaceSchema` (`src/cli/lib/schemas.ts:455-463`) and `Marketplace` type (`src/cli/types/plugins.ts:58-66`):

```json
{
  "$schema": "https://anthropic.com/claude-code/marketplace.schema.json",
  "name": "e2e-test-1710300000000",
  "version": "1.0.0",
  "description": "Community skills and stacks for Claude Code",
  "owner": {
    "name": "Agents Inc",
    "email": "hello@agents-inc.com"
  },
  "metadata": {
    "pluginRoot": "./dist/plugins"
  },
  "plugins": [
    {
      "name": "api-framework-hono",
      "source": "./dist/plugins/api-framework-hono",
      "description": "Lightweight web framework for the edge",
      "version": "1.0.0",
      "category": "api"
    },
    {
      "name": "meta-methodology-anti-over-engineering",
      "source": "./dist/plugins/meta-methodology-anti-over-engineering",
      "description": "Surgical implementation, not architectural innovation",
      "version": "1.0.0",
      "category": "methodology"
    },
    {
      "name": "web-framework-react",
      "source": "./dist/plugins/web-framework-react",
      "description": "React framework for building user interfaces",
      "version": "1.0.0",
      "category": "web"
    }
  ]
}
```

Schema validation constraints:

- `name`: `z.string().min(1)` -- **REQUIRED** (schemas.ts:457)
- `version`: `z.string().min(1)` -- **REQUIRED** (schemas.ts:458)
- `owner.name`: `z.string().min(1)` -- **REQUIRED** (schemas.ts:446)
- `plugins`: `z.array(marketplacePluginSchema).min(1)` -- **MUST have at least 1 entry** (schemas.ts:462)
- Each plugin: `name` required (min 1 char), `source` required (string or remote config), rest optional

### 1.4 How the Marketplace Is Registered with Claude CLI

Via `claudePluginMarketplaceAdd()` (`src/cli/utils/exec.ts:195-213`):

```typescript
// exec.ts:198 -- the actual Claude CLI invocation
const args = ["plugin", "marketplace", "add", source];
const result = await execCommand("claude", args, {});
```

Before calling the CLI, `validateMarketplaceSource()` (`exec.ts:42-63`) enforces:

- Non-empty, max 1024 characters
- Characters match `/^[a-zA-Z0-9._@/:~-]+$/`
- No control characters

The function silently returns if `"already installed"` appears in the error output (`exec.ts:208-209`).

### 1.5 Lifecycle: Build Once, Share via Temp Directory

```typescript
// Built ONCE in a suite-level beforeAll, NOT vitest globalSetup.
// Reason: globalSetup runs in a separate worker and cannot easily pass
// the temp directory path to test files. A beforeAll in the test file
// or a shared setup file is simpler.

let sharedFixture:
  | {
      sourceDir: string;
      tempDir: string;
      marketplaceName: string;
    }
  | undefined;

beforeAll(async () => {
  // 1. Create E2E source directory with 10 skills
  const { sourceDir, tempDir } = await createE2ESource();

  // 2. Build individual skill plugins
  //    CWD must be sourceDir. Default --skills-dir is "src/skills".
  const buildPluginsResult = await runCLI(["build", "plugins"], sourceDir);
  if (buildPluginsResult.exitCode !== 0) {
    throw new Error(`build plugins failed:\n${buildPluginsResult.combined}`);
  }

  // 3. Build marketplace.json from compiled plugins
  //    Default --plugins-dir is "dist/plugins". Default --output is ".claude-plugin/marketplace.json".
  const marketplaceName = `e2e-test-${Date.now()}`;
  const buildMarketplaceResult = await runCLI(
    ["build", "marketplace", "--name", marketplaceName],
    sourceDir,
  );
  if (buildMarketplaceResult.exitCode !== 0) {
    throw new Error(`build marketplace failed:\n${buildMarketplaceResult.combined}`);
  }

  sharedFixture = { sourceDir, tempDir, marketplaceName };
}, 60_000); // generous timeout for compilation

afterAll(async () => {
  if (sharedFixture) {
    await cleanupTempDir(sharedFixture.tempDir);
  }
});
```

Each individual test creates its own project temp directory with `HOME=<tempDir>` for isolation. The shared source directory is read-only during tests.

### 1.6 `createE2EPluginSource` Helper

New file: `e2e/helpers/create-e2e-plugin-source.ts`

```typescript
import path from "path";
import { createE2ESource } from "./create-e2e-source.js";
import { runCLI, createTempDir } from "./test-utils.js";
import type { RelationshipDefinitions } from "../../src/cli/types/index.js";

export type E2EPluginSource = {
  sourceDir: string;
  tempDir: string;
  marketplaceName: string;
  pluginsDir: string;
};

export async function createE2EPluginSource(options?: {
  marketplaceName?: string;
  relationships?: Partial<RelationshipDefinitions>;
}): Promise<E2EPluginSource> {
  const { sourceDir, tempDir } = await createE2ESource(
    options?.relationships ? { relationships: options.relationships } : undefined,
  );

  const buildPluginsResult = await runCLI(["build", "plugins"], sourceDir);
  if (buildPluginsResult.exitCode !== 0) {
    throw new Error(
      `build plugins failed (exit ${buildPluginsResult.exitCode}):\n${buildPluginsResult.combined}`,
    );
  }

  const marketplaceName = options?.marketplaceName ?? `e2e-test-${Date.now()}`;
  const buildMarketplaceResult = await runCLI(
    ["build", "marketplace", "--name", marketplaceName],
    sourceDir,
  );
  if (buildMarketplaceResult.exitCode !== 0) {
    throw new Error(
      `build marketplace failed (exit ${buildMarketplaceResult.exitCode}):\n${buildMarketplaceResult.combined}`,
    );
  }

  const pluginsDir = path.join(sourceDir, "dist", "plugins");

  return { sourceDir, tempDir, marketplaceName, pluginsDir };
}
```

---

## 2. Plugin State Verification

### 2.1 Where Plugins Are Stored: Two File Locations

Based on `plugin-settings.ts` (`src/cli/lib/plugins/plugin-settings.ts`):

**File 1: Project-scoped settings** -- `<projectDir>/.claude/settings.json`

Read by `getEnabledPluginKeys()` (`plugin-settings.ts:63-98`). Structure:

```json
{
  "permissions": { "allow": ["Read(*)"] },
  "enabledPlugins": {
    "web-framework-react@e2e-test-marketplace": true,
    "web-testing-vitest@e2e-test-marketplace": true
  }
}
```

- The `enabledPlugins` key is a `Record<string, unknown>` -- entries are filtered to only those with value `=== true` (`plugin-settings.ts:88-89`)
- Plugin key format: `"<skillId>@<marketplace>"` (`plugin-settings.ts:17-21`)
- Zod schema: `pluginSettingsSchema` (`plugin-settings.ts:34-38`) -- `.passthrough()` allows extra keys like `permissions`
- Constants: `SETTINGS_FILE = "settings.json"` (`plugin-settings.ts:57`), `CLAUDE_DIR = ".claude"` (`consts.ts:15`)

**File 2: Global plugin registry** -- `<HOME>/.claude/plugins/installed_plugins.json`

Read by `resolvePluginInstallPaths()` (`plugin-settings.ts:103-173`). Structure:

```json
{
  "version": 1,
  "plugins": {
    "web-framework-react@e2e-test-marketplace": [
      {
        "scope": "project",
        "projectPath": "/path/to/project",
        "installPath": "/path/to/installed/plugin",
        "version": "1.0.0",
        "installedAt": "2026-03-13T00:00:00Z",
        "lastUpdated": "2026-03-13T00:00:00Z",
        "gitCommitSha": "abc123"
      }
    ],
    "api-framework-hono@e2e-test-marketplace": [
      {
        "scope": "user",
        "installPath": "/home/user/.claude/plugins/api-framework-hono",
        "version": "1.0.0",
        "installedAt": "2026-03-13T00:00:00Z"
      }
    ]
  }
}
```

- Zod schema: `installedPluginsSchema` (`plugin-settings.ts:50-55`) with `pluginInstallationSchema` (`plugin-settings.ts:40-48`)
- Each plugin key maps to an **array** of installations (can have both project and user scope)
- `scope`: `"user" | "project" | "local"` (`plugin-settings.ts:41`)
- `projectPath`: optional, present for project-scoped installs (`plugin-settings.ts:42`)
- `installPath`: required, absolute path to the installed plugin directory (`plugin-settings.ts:43`)
- Constants: `PLUGINS_SUBDIR = "plugins"` (`consts.ts:17`), path is `os.homedir() + "/.claude/plugins/installed_plugins.json"` (`plugin-settings.ts:111`)

**Resolution order** in `resolvePluginInstallPaths()` (`plugin-settings.ts:140-165`):

1. Project-scoped installation matching `install.scope === "project" && install.projectPath === projectDir`
2. Fallback to user-scoped installation (`install.scope === "user"`)

**Verification** in `getVerifiedPluginInstallPaths()` (`plugin-settings.ts:179-198`):

- After resolving paths, checks each `installPath` for `<installPath>/.claude-plugin/plugin.json`
- Only verified paths are returned

### 2.2 Where Plugins Are Installed on Disk

Based on `plugin-finder.ts` (`src/cli/lib/plugins/plugin-finder.ts`):

- User plugins dir: `<HOME>/.claude/plugins/` (`plugin-finder.ts:23-25`)
- Project plugins dir: `<projectDir>/.claude/plugins/` (`plugin-finder.ts:32-35`)
- Plugin manifest: `<pluginDir>/.claude-plugin/plugin.json` (`plugin-finder.ts:45-47`)
- Plugin skills: `<pluginDir>/skills/` (`plugin-finder.ts:37-39`)
- Plugin agents: `<pluginDir>/agents/` (`plugin-finder.ts:41-43`)

Plugin discovery flow in `discoverAllPluginSkills()` (`src/cli/lib/plugins/plugin-discovery.ts:18-48`):

1. Read enabled plugin keys from `<projectDir>/.claude/settings.json`
2. Resolve install paths from `<HOME>/.claude/plugins/installed_plugins.json`
3. Verify each path has a valid manifest
4. Load skills from each verified plugin's `skills/` directory via `loadPluginSkills()`

### 2.3 Verification Helper Signatures

```typescript
// --- File: e2e/helpers/plugin-assertions.ts ---

import path from "path";
import { readFile } from "fs/promises";
import { CLAUDE_DIR, CLAUDE_SRC_DIR, STANDARD_FILES, STANDARD_DIRS } from "../../src/cli/consts.js";
import { fileExists, directoryExists } from "./test-utils.js";

/**
 * Checks whether a plugin key appears in <projectDir>/.claude/settings.json
 * under the `enabledPlugins` map with value `true`.
 *
 * The plugin key format is "<skillId>@<marketplace>".
 *
 * Reference: plugin-settings.ts:63-98 (getEnabledPluginKeys)
 */
export async function verifyPluginInSettings(
  projectDir: string,
  pluginKey: string,
): Promise<boolean> {
  const settingsPath = path.join(projectDir, CLAUDE_DIR, "settings.json");
  if (!(await fileExists(settingsPath))) return false;

  const content = await readFile(settingsPath, "utf-8");
  const settings = JSON.parse(content);
  return settings.enabledPlugins?.[pluginKey] === true;
}

/**
 * Checks whether a plugin's installation record exists in the global registry
 * at <HOME>/.claude/plugins/installed_plugins.json.
 *
 * When HOME is set to a temp dir (as in E2E tests), this checks the
 * temp dir's registry.
 *
 * Reference: plugin-settings.ts:103-173 (resolvePluginInstallPaths)
 */
export async function verifyPluginInRegistry(
  homeDir: string,
  pluginKey: string,
  scope?: "project" | "user",
): Promise<boolean> {
  const registryPath = path.join(homeDir, CLAUDE_DIR, "plugins", "installed_plugins.json");
  if (!(await fileExists(registryPath))) return false;

  const content = await readFile(registryPath, "utf-8");
  const registry = JSON.parse(content);
  const installations = registry.plugins?.[pluginKey];
  if (!Array.isArray(installations) || installations.length === 0) return false;

  if (scope) {
    return installations.some((i: { scope: string }) => i.scope === scope);
  }
  return true;
}

/**
 * Checks whether a skill was copied to <projectDir>/.claude/skills/<skillId>/
 * with a valid SKILL.md file.
 *
 * Reference: local-installer.ts (installLocal flow copies to LOCAL_SKILLS_PATH)
 */
export async function verifySkillCopiedLocally(
  projectDir: string,
  skillId: string,
): Promise<boolean> {
  const skillMdPath = path.join(
    projectDir,
    CLAUDE_DIR,
    STANDARD_DIRS.SKILLS,
    skillId,
    STANDARD_FILES.SKILL_MD,
  );
  return fileExists(skillMdPath);
}

/**
 * Checks whether an agent was compiled to <projectDir>/.claude/agents/<agentName>.md
 * and contains YAML frontmatter (starts with "---").
 *
 * Reference: init.tsx:468-476 (logs compiled agents)
 */
export async function verifyAgentCompiled(projectDir: string, agentName: string): Promise<boolean> {
  const agentPath = path.join(projectDir, CLAUDE_DIR, "agents", `${agentName}.md`);
  if (!(await fileExists(agentPath))) return false;
  const content = await readFile(agentPath, "utf-8");
  return content.startsWith("---");
}

/**
 * Verifies config.ts was written at <projectDir>/.claude-src/config.ts
 * and checks expected properties.
 */
export async function verifyConfig(
  projectDir: string,
  expectations: {
    /** Skill IDs that should appear in the skills array */
    skillIds?: string[];
    /** Source value that should appear (e.g., marketplace name or "local") */
    source?: string;
    /** Agent names that should appear */
    agents?: string[];
  },
): Promise<void> {
  const configPath = path.join(projectDir, CLAUDE_SRC_DIR, STANDARD_FILES.CONFIG_TS);
  const exists = await fileExists(configPath);
  if (!exists) throw new Error(`Config not found at ${configPath}`);

  const content = await readFile(configPath, "utf-8");

  if (expectations.skillIds) {
    for (const id of expectations.skillIds) {
      if (!content.includes(id)) {
        throw new Error(`Skill "${id}" not found in config.ts`);
      }
    }
  }

  if (expectations.source) {
    if (!content.includes(expectations.source)) {
      throw new Error(`Source "${expectations.source}" not found in config.ts`);
    }
  }

  if (expectations.agents) {
    for (const agent of expectations.agents) {
      if (!content.includes(agent)) {
        throw new Error(`Agent "${agent}" not found in config.ts`);
      }
    }
  }
}

/**
 * Asserts no local skills exist in <projectDir>/.claude/skills/.
 */
export async function verifyNoLocalSkills(projectDir: string): Promise<void> {
  const skillsDir = path.join(projectDir, CLAUDE_DIR, STANDARD_DIRS.SKILLS);
  const exists = await directoryExists(skillsDir);
  if (exists) {
    const { readdir } = await import("fs/promises");
    const entries = await readdir(skillsDir);
    if (entries.length > 0) {
      throw new Error(`Expected no local skills but found: ${entries.join(", ")}`);
    }
  }
}

/**
 * Asserts no plugins are enabled in <projectDir>/.claude/settings.json.
 */
export async function verifyNoPlugins(projectDir: string): Promise<void> {
  const settingsPath = path.join(projectDir, CLAUDE_DIR, "settings.json");
  if (!(await fileExists(settingsPath))) return; // no settings = no plugins

  const content = await readFile(settingsPath, "utf-8");
  const settings = JSON.parse(content);
  const enabled = settings.enabledPlugins;
  if (enabled) {
    const activeKeys = Object.entries(enabled).filter(([, v]) => v === true);
    if (activeKeys.length > 0) {
      throw new Error(`Expected no plugins but found: ${activeKeys.map(([k]) => k).join(", ")}`);
    }
  }
}
```

---

## 3. Installation Mode Matrix

Based on actual code in `installation.ts` (`deriveInstallMode` at line 26-32), `init.tsx` (lines 380-494), `edit.tsx` (lines 260-364), and `uninstall.tsx` (lines 297-327):

| Mode                | Scope       | How It's Installed                                                    | Where Skills Live                                    | Where It's Recorded                                                                                                                                                           |
| ------------------- | ----------- | --------------------------------------------------------------------- | ---------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Local, Project**  | `"project"` | `installLocal()` copies from source to `.claude/skills/`              | `<projectDir>/.claude/skills/<skillId>/`             | `<projectDir>/.claude-src/config.ts` with `source: "local"`                                                                                                                   |
| **Local, Global**   | `"global"`  | `installLocal()` copies to `<HOME>/.claude/skills/`                   | `<HOME>/.claude/skills/<skillId>/`                   | `<HOME>/.claude-src/config.ts` with `source: "local"`                                                                                                                         |
| **Plugin, Project** | `"project"` | `claudePluginInstall(ref, "project", projectDir)` (`exec.ts:131-145`) | Claude CLI manages; path in `installed_plugins.json` | `<projectDir>/.claude/settings.json` `enabledPlugins` + `<HOME>/.claude/plugins/installed_plugins.json` + `<projectDir>/.claude-src/config.ts` with `source: "<marketplace>"` |
| **Plugin, User**    | `"global"`  | `claudePluginInstall(ref, "user", homedir())` (`exec.ts:131-145`)     | Claude CLI manages; path in `installed_plugins.json` | `<HOME>/.claude/settings.json` `enabledPlugins` + `<HOME>/.claude/plugins/installed_plugins.json` + config.ts with `source: "<marketplace>"`                                  |
| **Mixed**           | Both        | Some skills local, some plugin                                        | Both locations                                       | Both settings.json and config.ts                                                                                                                                              |

**Install mode derivation** (`installation.ts:26-32`):

```typescript
function deriveInstallMode(skills: SkillConfig[]): InstallMode {
  if (skills.length === 0) return "local";
  const hasLocal = skills.some((s) => s.source === "local");
  const hasPlugin = skills.some((s) => s.source !== "local");
  if (hasLocal && hasPlugin) return "mixed";
  return hasLocal ? "local" : "plugin";
}
```

**Plugin ref format** used with Claude CLI: `"<skillId>@<marketplace>"` (init.tsx:438, edit.tsx:316, edit.tsx:342)

**Scope mapping** (init.tsx:439, edit.tsx:311-312):

- Wizard `scope: "global"` -> Claude CLI `scope: "user"`
- Wizard `scope: "project"` -> Claude CLI `scope: "project"`

**Install directory** (init.tsx:440, edit.tsx:314,317):

- `scope: "user"` -> `os.homedir()`
- `scope: "project"` -> `projectDir`

---

## 4. Test Scenarios: Immediate Priority

### 4.1 Core Plugin Flows

#### P-INIT-1: Init with plugin mode installs plugins

**Setup:**

1. `createE2EPluginSource()` -- builds source with marketplace.json
2. `createTempDir()` for project directory
3. `createPermissionsFile(projectDir)` -- prevents permission checker hang

**Action:**
Drive init wizard via `TerminalSession`:

- `["init", "--source", sourceDir]` with `env: { AGENTSINC_SOURCE: undefined, HOME: projectDir }`
- Navigate: Choose stack -> Enter -> Select domains -> Enter -> Accept defaults -> `"a"` -> Confirm -> Enter
- Wait for `"initialized successfully"` (`init.tsx:471`)

**Verification:**

- Exit code 0
- Output contains `"Installing skill plugins..."` (`init.tsx:436`)
- Output contains `"Installed ${pluginRef}"` for at least one skill (`init.tsx:443`)
- Output contains `"Installed ${count} skill plugins"` (`init.tsx:452`)
- `verifyConfig(projectDir, { skillIds: ["web-framework-react"], source: marketplaceName })`
- `verifyAgentCompiled(projectDir, "web-developer")`

#### P-INIT-2: Marketplace registration on first use

**Setup:** Same as P-INIT-1, but ensure marketplace is NOT pre-registered.

**Action:** Same wizard flow.

**Verification:**

- Output contains `"Registering marketplace"` (`init.tsx:424`)
- Output contains `"Registered marketplace: ${marketplace}"` (`init.tsx:428`)

#### P-INIT-3: Marketplace NOT re-registered when already present

**Setup:**

1. Same as P-INIT-1
2. Pre-register marketplace: `execCommand("claude", ["plugin", "marketplace", "add", sourceDir])` before running init

**Action:** Same wizard flow.

**Verification:**

- Output does NOT contain `"Registering marketplace"` (`init.tsx:424`)

#### P-INIT-4: Fallback to local when marketplace resolution fails

**Setup:**

1. `createE2ESource()` (no marketplace.json built)
2. Source with no `.claude-plugin/marketplace.json`

**Action:** Init with `--source` pointing to the un-built source. The wizard will complete but `fetchMarketplace()` will fail at `init.tsx:409`.

**Verification:**

- Output contains `"Could not resolve marketplace. Falling back to Local Mode..."` (`init.tsx:412`)
- `verifySkillCopiedLocally(projectDir, "web-framework-react")` -- falls back to local

#### P-INIT-5: Partial installation failure leaves inconsistent state

**Setup:**

1. `createE2EPluginSource()` with multiple skills
2. Create project directory, register marketplace
3. Simulate a failing plugin install for the 2nd skill (e.g., corrupt plugin source or invalid ref)

**Action:** Run init wizard selecting 3+ plugin skills, where one install fails mid-loop.

**Verification:**

- `this.error()` at `init.tsx:445-447` exits the process immediately when any single plugin install fails
- Skills installed before the failure remain installed (directory on disk, entry in `installed_plugins.json`)
- Skills after the failure are never attempted
- No config.ts is written (the `installPluginConfig()` call at `init.tsx:456` is never reached)
- The project is left in an inconsistent state: some plugins installed but no config generated
- **No existing test coverage for this error path**

#### P-INIT-6: Mixed install mode routes plugin skills to local installer

**Setup:**

1. `createE2EPluginSource()`
2. Configure wizard result with a mix of `source: "local"` and `source: "<marketplace>"` skills

**Action:** Run init with a skill set that triggers `deriveInstallMode()` returning `"mixed"` (`installation.ts:30`).

**Verification:**

- `handleInstallation()` (`init.tsx:392-397`) only checks for `installMode === "plugin"` -- the `"mixed"` mode falls through to `installLocalMode()` at `init.tsx:397`
- Plugin-sourced skills in the mixed set do NOT get `claudePluginInstall()` called -- they are copied locally instead
- Document whether this is intentional behavior or a missing code path

### 4.2 Core Edit Flows (Plugin Mode)

#### P-EDIT-1: Add skill via edit triggers plugin install

**Setup:**

1. `createE2EPluginSource()`
2. Create project with 1 plugin skill via `createPluginProject()` (config has `web-framework-react` only)
3. Pre-install the existing skill via `claudePluginInstall()`
4. Register marketplace via `claudePluginMarketplaceAdd()`

**Action:**
Interactive edit via `TerminalSession` with `["edit", "--source", sourceDir]`:

- Navigate to build step, add `web-testing-vitest`, confirm

**Verification:**

- Output contains `"Installing plugin: web-testing-vitest@${marketplace}..."` (`edit.tsx:345`)
- `verifyPluginInSettings(projectDir, "web-testing-vitest@" + marketplace)`

#### P-EDIT-2: Remove skill via edit triggers plugin uninstall

**Setup:** Same as P-EDIT-1 but start with 2 skills installed.

**Action:** Interactive edit, deselect `web-testing-vitest`, confirm.

**Verification:**

- Output contains `"Uninstalling plugin: web-testing-vitest..."` (`edit.tsx:357`)

#### P-EDIT-3: Mode migration local -> plugin

**Setup:**

1. `createE2EPluginSource()`
2. Create project with local-mode skill (`source: "local"`)
3. Copy skill files to `.claude/skills/`
4. Register marketplace

**Action:** Interactive edit, change skill source from local to plugin (via Sources step `P` hotkey).

**Verification:**

- Output contains `"Switching ${count} skill(s) to plugin:"` (`edit.tsx:285-289`)
- `verifyNoLocalSkills(projectDir)` -- local copy deleted
- Migration delegates to `executeMigration()` (`mode-migrator.ts:80-149`)

#### P-EDIT-4: Mode migration plugin -> local

**Setup:** Inverse of P-EDIT-3 -- start with plugin-mode skill.

**Action:** Interactive edit, change skill source from plugin to local.

**Verification:**

- Output contains `"Switching ${count} skill(s) to local:"` (`edit.tsx:280-283`)
- `verifySkillCopiedLocally(projectDir, skillId)` -- local copy created
- Plugin uninstalled via `claudePluginUninstall()` in `executeMigration()` (`mode-migrator.ts:105-115`)

#### P-EDIT-5: Source change marketplace A -> marketplace B (potential bug)

**Setup:** Project with plugin skill from marketplace A.

**Action:** Edit to change source to marketplace B.

**Verification:**

- Document CURRENT behavior: `edit.tsx:326-333` only handles `change.from === "local"`. Non-local-to-non-local source changes skip the `if` block -- old plugin stays installed, no new plugin installed. This test documents whether this is intentional.
- **Follow-up:** Once the bug is confirmed, add a separate test verifying the fix: old plugin from marketplace A should be uninstalled, new plugin from marketplace B should be installed, and config.ts should reference marketplace B as the source.

### 4.3 Core Uninstall Flows (Plugin Mode)

#### P-UNINSTALL-1: Uninstall with plugins calls Claude CLI

**Setup:**

1. Project with plugin-mode skills in config
2. `.claude/settings.json` with `enabledPlugins` entries
3. Installed plugins on disk

**Action:**

```
runCLI(["uninstall", "--yes"], projectDir)
```

**Verification:**

- Output contains `"  Uninstalled plugin '${pluginName}'"` per plugin (`uninstall.tsx:315`) -- note leading spaces and single quotes
- Output contains `logSuccess("Uninstalled ${count} plugin")` or `"Uninstalled ${count} plugins"` (`uninstall.tsx:318-319`) -- pluralized based on count
- `verifyNoPlugins(projectDir)` -- settings.json cleared

The uninstall detection flow (`uninstall.tsx:61-107`):

1. `listPluginNames(projectDir)` discovers enabled plugins via `getVerifiedPluginInstallPaths()`
2. `getCliInstalledPluginKeys(config)` builds a set of `"${skill.id}@${skill.source}"` from config skills (`uninstall.tsx:56-59`)
3. `cliPluginNames` = intersection of discovered plugins with CLI-installed keys (`uninstall.tsx:88`)

#### P-UNINSTALL-2: Uninstall preserves non-CLI plugins

**Setup:**

1. Project with a plugin NOT in config.ts (manually placed in `.claude/plugins/`)
2. Project with a plugin that IS in config.ts

**Action:** `runCLI(["uninstall", "--yes"], projectDir)`

**Verification:**

- Only the config-tracked plugin is uninstalled
- The manually-placed plugin directory still exists

#### P-UNINSTALL-3: Uninstall when Claude CLI not available

**Setup:** Project with plugin-mode skills, but `claude` not on PATH.

**Action:** `runCLI(["uninstall", "--yes"], projectDir, { env: { PATH: "/nonexistent" } })`

**Verification:**

- `isClaudeCLIAvailable()` returns false (`uninstall.tsx:301`)
- Plugin directories still removed via `remove(pluginPath)` (`uninstall.tsx:313-314`) -- this runs **unconditionally** for every plugin, regardless of CLI availability
- No `claudePluginUninstall()` call attempted (`uninstall.tsx:304-311` is guarded by `if (cliAvailable)`)
- The per-plugin log `"Uninstalled plugin '${pluginName}'"` (`uninstall.tsx:315`) still appears
- The summary `logSuccess()` still appears (`uninstall.tsx:318-319`)

### 4.4 Build Pipeline Tests

#### P-BUILD-1: `build plugins` produces valid plugin directories

**Setup:** `createE2ESource()`

**Action:** `runCLI(["build", "plugins"], sourceDir)`

**Verification:**

- Exit code 0
- Output contains `"Compiled ${count} skill plugins"` (`plugins.ts:88`)
- For each of 10 skills: `<sourceDir>/dist/plugins/<skillName>/.claude-plugin/plugin.json` exists
- Manifest JSON is valid: has `name`, `version` fields

#### P-BUILD-2: `build marketplace` produces valid marketplace.json

**Setup:** After P-BUILD-1 (plugins already built).

**Action:** `runCLI(["build", "marketplace", "--name", "test-mp"], sourceDir)`

**Verification:**

- Exit code 0
- `<sourceDir>/.claude-plugin/marketplace.json` exists
- JSON has `name === "test-mp"`, `version` is string, `plugins` array has >= 1 entry
- Output contains `"Marketplace generated with ${count} plugins!"` (`marketplace.ts:134`)

### 4.5 Existing Local-Mode Coverage (Already Tested)

These flows are comprehensively covered by existing E2E tests:

| Flow                          | Test File                                        | Coverage                                                                                                                                       |
| ----------------------------- | ------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Init wizard stack flow        | `e2e/interactive/init-wizard-stack.e2e.test.ts`  | Full flow, config verification, agent compilation                                                                                              |
| Init wizard domain/build flow | `e2e/interactive/init-wizard-domain.e2e.test.ts` | Domain selection, build step navigation                                                                                                        |
| Init wizard flags             | `e2e/interactive/init-wizard-flags.e2e.test.ts`  | `--source`, `--refresh` flags                                                                                                                  |
| Edit wizard                   | `e2e/interactive/edit-wizard.e2e.test.ts`        | Full local-mode edit flow: add/remove skills, recompile, cancellation, keyboard nav, hotkeys, --source flag, build validation, global fallback |
| Uninstall                     | `e2e/commands/uninstall.e2e.test.ts`             | `--yes`, `--all`, selective removal                                                                                                            |
| Compile                       | `e2e/commands/compile.e2e.test.ts`               | Local compile, dual-scope                                                                                                                      |
| Validate                      | `e2e/commands/validate.e2e.test.ts`              | Source validation                                                                                                                              |
| Plugin smoke tests            | `e2e/commands/plugin-install.e2e.test.ts`        | CLI availability, doesn't-hang verification                                                                                                    |

---

## 5. Deferred Test Scenarios

### 5.1 Multiple Marketplace Testing

Testing skills from marketplace A + skills from marketplace B simultaneously. Requires two separate `createE2EPluginSource()` calls with different marketplace names, then an init that references both. Low priority because the common case is a single marketplace.

### 5.2 `--source` Flag with Different Marketplace

Testing `init --source <path-to-different-marketplace>` when a default marketplace is already configured. Requires understanding how `fetchMarketplace()` (`src/cli/lib/loading/source-fetcher.ts:244-264`) resolves the marketplace from a source path.

### 5.3 Marketplace Switching During Edit

Changing the `--source` flag value between init and edit to point to a different marketplace. Interacts with the source change code at `edit.tsx:325-333`. See P-EDIT-5 for the potential bug in this area.

### 5.4 `--refresh` Flag Behavior

Testing `init --refresh` and `edit --refresh` which force re-fetching of source data. The `forceRefresh` option propagates through `fetchFromSource()`. No existing E2E coverage.

### 5.5 Global Installation + Project Creation Prompt

Testing the flow where a user-scoped installation exists and `init` prompts to create a project-scoped installation. This is difficult to test because `HOME` isolation prevents triggering the global-install detection path.

### 5.6 Plugin Scope Migration (P <-> G)

Testing edit with scope changes for plugin-mode skills (`edit.tsx:309-321`). The scope change silently uninstalls from old scope and reinstalls to new scope. No explicit success log -- only a failure warning: `"Failed to migrate plugin scope for ${skillId}"` (`edit.tsx:320`). Verification requires checking end state in `installed_plugins.json`.

---

## 6. Infrastructure Changes

### 6.1 New Files

| File                                             | Purpose                                                                                                                                                                                                                              |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `e2e/helpers/create-e2e-plugin-source.ts`        | `createE2EPluginSource()` -- builds source + plugins + marketplace.json. Signature in Section 1.6.                                                                                                                                   |
| `e2e/helpers/plugin-assertions.ts`               | Verification helpers: `verifyPluginInSettings()`, `verifyPluginInRegistry()`, `verifySkillCopiedLocally()`, `verifyAgentCompiled()`, `verifyConfig()`, `verifyNoLocalSkills()`, `verifyNoPlugins()`. Full signatures in Section 2.3. |
| `e2e/commands/plugin-init.e2e.test.ts`           | Non-interactive plugin init tests (P-INIT series). Uses `runCLI` + `createE2EPluginSource`.                                                                                                                                          |
| `e2e/commands/plugin-build.e2e.test.ts`          | Build pipeline tests (P-BUILD series). Uses `runCLI` + `createE2ESource`.                                                                                                                                                            |
| `e2e/commands/plugin-uninstall.e2e.test.ts`      | Plugin uninstall tests (P-UNINSTALL series). Uses `runCLI`.                                                                                                                                                                          |
| `e2e/interactive/init-wizard-plugin.e2e.test.ts` | Interactive plugin init tests. Uses `TerminalSession` + `createE2EPluginSource`.                                                                                                                                                     |
| `e2e/interactive/edit-wizard-plugin.e2e.test.ts` | Interactive plugin edit tests (P-EDIT series). Uses `TerminalSession`.                                                                                                                                                               |

### 6.2 Modified Files

| File                        | Change                                                                                                                                                                      |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `e2e/helpers/test-utils.ts` | Add `PLUGIN_INSTALL_TIMEOUT_MS = 30_000` constant. Add `createPluginProject()` helper for creating pre-initialized plugin-mode projects (for edit/uninstall/compile tests). |

### 6.3 No globalSetup

Do NOT use vitest `globalSetup` for the shared marketplace fixture. Reasons:

- `globalSetup` runs in a separate worker -- passing the temp directory path to test files requires writing to a known location or using env vars
- Suite-level `beforeAll` in each test file is simpler and more explicit
- `createE2EPluginSource()` caches nothing -- each test file creates its own if needed
- The build step takes ~5 seconds, not minutes -- per-file overhead is acceptable

### 6.4 `createPluginProject` Helper (in test-utils.ts)

```typescript
/**
 * Creates a project directory that looks like it was initialized in plugin mode.
 * Config references a marketplace source. No actual plugins are installed.
 * Use for edit/uninstall/compile tests that need a pre-existing project.
 */
export async function createPluginProject(
  tempDir: string,
  options?: {
    skills?: SkillId[];
    agents?: AgentName[];
    marketplace?: string;
  },
): Promise<string> {
  const projectDir = path.join(tempDir, "project");
  const skills = options?.skills ?? ["web-framework-react"];
  const agents = options?.agents ?? ["web-developer"];
  const marketplace = options?.marketplace ?? "e2e-test-marketplace";

  await writeProjectConfig(projectDir, {
    name: "plugin-test-project",
    skills: skills.map((id) => ({
      id,
      scope: "project" as const,
      source: marketplace,
    })),
    agents: agents.map((name) => ({ name, scope: "project" as const })),
    domains: ["web"],
  });

  return projectDir;
}
```

---

## 7. Open Blockers

### 7.1 ~~BLOCKER:~~ Full Plugin Chain Proof-of-Concept (RESOLVED 2026-03-13)

**Test file:** `e2e/blockers/plugin-chain-poc.e2e.test.ts` (5 tests, all passing)

All 5 questions answered YES:

1. `build plugins` succeeds against E2E source — nested `src/skills/<category>/<skillId>/` structure is discovered correctly via `**/SKILL.md` scan
2. `build marketplace` finds compiled plugins in `dist/plugins/` and produces valid `marketplace.json` with correct name and plugin count
3. `claude plugin marketplace add <sourceDir>` accepts a local directory path and registers the marketplace
4. `claude plugin install web-framework-react@<marketplace>` successfully installs the plugin
5. `installed_plugins.json` contains the entry with `scope: "project"` after install

**Infrastructure created:**

- `e2e/helpers/create-e2e-plugin-source.ts` — `createE2EPluginSource()` helper (builds source + plugins + marketplace.json)
- `e2e/helpers/plugin-assertions.ts` — 7 verification helpers for plugin state

### 7.2 ~~`build plugins` Flag Resolution~~ (RESOLVED by 7.1)

Confirmed working in Blocker 7.1 test. The `--skills-dir` default resolves correctly when `cwd` is the E2E source directory. Nested `src/skills/<category>/<skillId>/` structure is discovered via `**/SKILL.md` glob scan.

### 7.3 `fetchMarketplace` with Local Paths

`fetchMarketplace()` (`src/cli/lib/loading/source-fetcher.ts:244-264`) calls `fetchFromSource()` which expects a source string like `"github:owner/repo"` or a local path. For E2E tests using `--source <localDir>`, the source is a local path. The `fetchFromSource()` function must handle this -- needs verification.

### 7.4 ~~`AGENTSINC_SOURCE` Env Var~~ (RESOLVED)

The init command reads `AGENTSINC_SOURCE` to determine the default source. E2E tests MUST set `AGENTSINC_SOURCE: undefined` in the env to prevent the real marketplace from being used. This is already handled in existing tests (`init-wizard-stack.e2e.test.ts:61`):

```typescript
env: { AGENTSINC_SOURCE: undefined },
```

**Resolved:** This pattern is established and working. New plugin E2E tests should follow the same convention.

### 7.5 Permission Checker in Non-TTY Mode

The `checkPermissions()` function (`init.tsx:486-490`) renders a blocking Ink component after install. In PTY mode (TerminalSession), this hangs unless `createPermissionsFile()` is called first. In non-interactive `runCLI()` mode, the Ink component may also hang because `execa` doesn't allocate a TTY. Need to verify whether `runCLI()` tests need `createPermissionsFile()` too.

Existing workaround (`e2e/helpers/test-utils.ts:235-242`):

```typescript
export async function createPermissionsFile(projectDir: string): Promise<void> {
  const claudeDir = path.join(projectDir, CLAUDE_DIR);
  await mkdir(claudeDir, { recursive: true });
  await writeFile(
    path.join(claudeDir, "settings.json"),
    JSON.stringify({ permissions: { allow: ["Read(*)"] } }),
  );
}
```

### 7.6 ~~HOME Isolation and Claude CLI Auth~~ (RESOLVED 2026-03-13)

**Test file:** `e2e/blockers/home-isolation.e2e.test.ts` (4 tests, all passing)

All Claude CLI plugin commands work with `HOME=<tempDir>`:

- `claude --version`: exit code 0, version string returned
- `claude plugin marketplace list --json`: completes, returns data (no auth error)
- `claude plugin marketplace add <dir>`: completes without auth error
- `claude plugin install <nonexistent>`: completes without hanging (fails with expected error)

**Conclusion:** Option 1 was correct — Claude CLI plugin commands work without auth for local operations. Full HOME isolation is available for all plugin E2E tests.

---

## 8. Environment Requirements

### 8.1 Required Environment Variables

| Variable           | Value       | Why                                                                                                              |
| ------------------ | ----------- | ---------------------------------------------------------------------------------------------------------------- |
| `AGENTSINC_SOURCE` | `undefined` | Prevents real marketplace from being used as default source                                                      |
| `HOME`             | `<tempDir>` | Isolates Claude CLI state from user's real config. Both `runCLI()` and `TerminalSession` set this automatically. |
| `NO_COLOR`         | `"1"`       | Disables color output in PTY mode (already set by `TerminalSession`, `terminal-session.ts:57`)                   |
| `FORCE_COLOR`      | `"0"`       | Disables forced color (already set by `TerminalSession`, `terminal-session.ts:58`)                               |

### 8.2 Filesystem Prerequisites

| Prerequisite       | How to Satisfy                                               | Why                                                        |
| ------------------ | ------------------------------------------------------------ | ---------------------------------------------------------- |
| CLI binary built   | `ensureBinaryExists()` in `beforeAll`                        | Tests run via `node bin/run.js` which requires compilation |
| Permissions file   | `createPermissionsFile(projectDir)` before interactive tests | Prevents permission checker Ink component from hanging PTY |
| Claude CLI on PATH | `isClaudeCLIAvailable()` check + `describe.skipIf()`         | Plugin tests require the real Claude CLI binary            |

### 8.3 Skip Pattern

All plugin-mode tests use the conditional skip pattern established in `plugin-install.e2e.test.ts:30-32`:

```typescript
import { isClaudeCLIAvailable } from "../../src/cli/utils/exec.js";

const claudeAvailable = await isClaudeCLIAvailable();

describe.skipIf(!claudeAvailable)("plugin mode tests", () => {
  // ...
});
```

### 8.4 Input Validation Constraints

`exec.ts` validators run before any Claude CLI call. E2E test data must satisfy:

| Validator                                     | Pattern                   | Max Length |
| --------------------------------------------- | ------------------------- | ---------- |
| `validatePluginPath()` (exec.ts:19-40)        | `/^[a-zA-Z0-9._@/:~-]+$/` | 1024 chars |
| `validateMarketplaceSource()` (exec.ts:42-63) | `/^[a-zA-Z0-9._@/:~-]+$/` | 1024 chars |
| `validatePluginName()` (exec.ts:65-86)        | `/^[a-zA-Z0-9._@/-]+$/`   | 256 chars  |

E2E test marketplace names like `"e2e-test-1710300000000"` satisfy all patterns.

### 8.5 Timing Constants

| Constant                          | Value    | Usage                                      |
| --------------------------------- | -------- | ------------------------------------------ |
| `WIZARD_LOAD_TIMEOUT_MS`          | `10_000` | Wait for wizard to render first step       |
| `INSTALL_TIMEOUT_MS`              | `30_000` | Wait for install to complete               |
| `STEP_TRANSITION_DELAY_MS`        | `500`    | Delay after step transitions               |
| `KEYSTROKE_DELAY_MS`              | `150`    | Delay after single keystrokes              |
| `EXIT_TIMEOUT_MS`                 | `10_000` | Wait for PTY to exit                       |
| `PLUGIN_INSTALL_TIMEOUT_MS` (NEW) | `30_000` | Wait for `claudePluginInstall` to complete |

---

## 9. Review Findings Log

**Reviewed:** 2026-03-13
**Reviewer:** Manual code review against source

### Summary

- **2 critical blockers RESOLVED:** 7.1 (full plugin chain) and 7.6 (HOME isolation) both pass — all plugin E2E tests are now unblocked
- **7 corrections applied in this update:**
  1. P-UNINSTALL-3: Fixed inaccurate "filesystem fallback" description -- `remove(pluginPath)` runs unconditionally, not as a fallback
  2. P-INIT-5 added: Partial installation failure leaves inconsistent state (no test coverage for `this.error()` mid-loop)
  3. P-INIT-6 added: Mixed install mode silently routes plugin skills to local installer
  4. Section 4.5 edit-wizard coverage updated to reflect actual comprehensive test scope (17 test cases)
  5. Blocker 7.4 marked resolved -- `AGENTSINC_SOURCE: undefined` pattern already established
  6. P-UNINSTALL-1 log format corrected to match actual output (leading spaces, single quotes, pluralized suffix)
  7. P-EDIT-5 follow-up note added for fix verification test
- **Architecture deemed sound:** No race conditions found in plugin install/uninstall flows; sequential loops with early exit on failure
- **All existing test coverage claims verified accurate** against test files
- **Line references verified against source code:** Minor drift noted in a few line numbers but all referenced code blocks confirmed present and correct

### Implementation Progress (2026-03-13)

**Phase 1: Infrastructure + Blockers — COMPLETE (13 tests)**

| File                                        | Tests                | Status      |
| ------------------------------------------- | -------------------- | ----------- |
| `e2e/helpers/create-e2e-plugin-source.ts`   | helper               | Created     |
| `e2e/helpers/plugin-assertions.ts`          | helper (7 functions) | Created     |
| `e2e/blockers/plugin-chain-poc.e2e.test.ts` | 5                    | All passing |
| `e2e/blockers/home-isolation.e2e.test.ts`   | 4                    | All passing |

**Phase 2: Build Pipeline + Uninstall — COMPLETE (20 tests)**

| File                                        | Tests                                   | Status      |
| ------------------------------------------- | --------------------------------------- | ----------- |
| `e2e/commands/plugin-build.e2e.test.ts`     | 8 (P-BUILD-1: 4, P-BUILD-2: 4)          | All passing |
| `e2e/commands/plugin-uninstall.e2e.test.ts` | 12 (P-UNINSTALL-1: 8, P-UNINSTALL-3: 4) | All passing |

**Phase 3: Interactive Plugin Init — COMPLETE (6 tests)**

| File                                             | Tests                                       | Status             |
| ------------------------------------------------ | ------------------------------------------- | ------------------ |
| `e2e/interactive/init-wizard-plugin.e2e.test.ts` | 6 (P-INIT-1: 4, P-INIT-2/3: 1, P-INIT-4: 1) | All passing (~45s) |

**P-INIT-4 investigation finding:** The fallback warning path (`"Could not resolve marketplace. Falling back to Local Mode..."` at init.tsx:412) is NOT testable with temp dirs. It requires a remote source (github:...) without marketplace.json. With local sources, `isLocalSource()` returns true, skills are tagged `source: "local"`, and `deriveInstallMode()` returns `"local"` — `installIndividualPlugins()` is never entered. The test verifies the observable behavior: source without marketplace installs locally.

**Phase 4: Interactive Plugin Edit — COMPLETE (6 tests)**

| File                                             | Tests                                                                           | Status      |
| ------------------------------------------------ | ------------------------------------------------------------------------------- | ----------- |
| `e2e/interactive/edit-wizard-plugin.e2e.test.ts` | 8 (P-EDIT-2: 3, P-EDIT-1: 1, P-EDIT-3: 1, P-EDIT-4: 1, no-change: 1, cancel: 1) | All passing |

**Critical finding — `marketplace` field in config:** The `createPluginProject()` helper MUST set the top-level `marketplace` field in config.ts. Without it, `resolveSource()` returns `sourceResult.marketplace = undefined`, and the `if (sourceResult.marketplace)` guard at `edit.tsx:334` silently skips all plugin install/uninstall operations.

**P-EDIT-3 and P-EDIT-4 (mode migration):** COMPLETE — implemented using `L` and `P` hotkeys in Sources customize view. Navigation: Build (Enter) → Sources choice (Arrow Down + Enter for "Customize") → Sources customize (press hotkey + Enter) → Agents → Confirm → Complete. The `L`/`P` bulk hotkeys avoid fragile per-skill SourceGrid navigation.

**Key Learnings:**

1. **HOME isolation vs real HOME:** `claudePluginInstall()` writes to the real HOME's `installed_plugins.json`. Tests that install plugins then uninstall must use real HOME for `runCLI()` so the CLI finds the registry. For tests that don't need real plugin installs, HOME isolation works fine.
2. **createPermissionsFile overwrite risk:** `createPermissionsFile()` overwrites `settings.json` with only `{ permissions: {...} }`, destroying `enabledPlugins` entries written by `claudePluginInstall()`. Never call it after plugin installation. Call it BEFORE plugin operations.
3. **Uninstall handles missing plugins gracefully:** Config can reference plugins that aren't installed. The uninstall command intersects config skills with settings.json `enabledPlugins` — only matching entries trigger `claudePluginUninstall()`.
4. **`forkedFrom` metadata required:** Skill directories need `metadata.yaml` with `forkedFrom` data for the uninstall skill removal logic to work correctly.
5. **"Unresolvable skill" pattern for P-EDIT-2:** Include a skill in config that's NOT in the E2E source (e.g., `web-styling-tailwind`). The wizard can't resolve it, drops it from the result, and the edit command treats it as "removed" — triggering `claudePluginUninstall()`. No manual deselection needed.
6. **Config `marketplace` field is required:** Without `marketplace` at the top level of the project config, `sourceResult.marketplace` stays undefined, silently disabling all plugin operations in the edit command.

**Phase 5: Lifecycle Tests — COMPLETE (2 tests)**

| File                                         | Tests                                             | Status           |
| -------------------------------------------- | ------------------------------------------------- | ---------------- |
| `e2e/lifecycle/local-lifecycle.e2e.test.ts`  | 1 (4 phases: init → compile → uninstall → verify) | Passing (~6.4s)  |
| `e2e/lifecycle/plugin-lifecycle.e2e.test.ts` | 1 (2 phases: plugin init → uninstall)             | Passing (~10.3s) |

**Lifecycle test design decisions:**

- **Simplified from design doc:** The original Section 3.1 designed a 5-phase cross-scope test (global init → project init → edit global from project → compile → uninstall). Implemented as pragmatic single-scope tests instead because: (1) UX for editing global scope from project context is undefined (Section 8 open question), (2) Bug A (agent scope routing) needs fixing first, (3) cross-scope editing will be added once the UX and fix are in place.
- **Local lifecycle (4 phases):** Init via TerminalSession → verify config/agents/skills → Compile via runCLI → verify agents recompiled → Uninstall --yes → verify clean state (skills/agents removed, config preserved).
- **Plugin lifecycle (2 phases):** Plugin init via TerminalSession → verify config with marketplace source, agents compiled, settings file exists → Uninstall --yes → verify agents removed, config preserved.
- **No state leakage:** Both tests use isolated temp directories. Session is destroyed before non-interactive commands.

**Phase 5 Learnings:** 7. **Lifecycle tests work as single sequential `it()` blocks:** Each phase depends on the previous, so a single `it()` with inline comments per phase is cleaner than nested `describe()` blocks that can't share state. 8. **Session cleanup between phases:** `session.destroy()` must be called before non-interactive `runCLI()` commands to avoid PTY process interference. 9. **Config persistence after uninstall:** `uninstall --yes` (without `--all`) preserves `.claude-src/config.ts`. This is correct behavior — only `--all` removes the config directory.

**Phase 6: Bug Reproduction Tests — COMPLETE (2 tests)**

| File                                            | Tests                            | Status        |
| ----------------------------------------------- | -------------------------------- | ------------- |
| `e2e/bugs/edit-skill-accumulation.e2e.test.ts`  | 1 (Bug B: skill scope isolation) | Passing (~4s) |
| `e2e/bugs/edit-agent-scope-routing.e2e.test.ts` | 1 (Bug A: agent scope routing)   | Passing (~4s) |

**Bug A finding:** The bug appears to be already fixed. `agent-recompiler.ts:128-154` has correct scope routing logic: `scope = agentScopeMap?.get(agentName) ?? "project"` with `targetDir = scope === "global" ? globalAgentsDir : agentsDir`. The edit command at `edit.tsx:405` correctly builds the scope map from `result.agentConfigs`. The test serves as a regression guard.

**Bug B finding:** The `splitConfigByScope()` function correctly filters skills by scope. Global skills go to the global config, project skills go to the project config. The test uses a mixed-scope project config (global + project skills), runs a no-op edit, and verifies the project config only retains project-scoped skills while using `...globalConfig.skills` spread for global inheritance.

**Bug A test technique — "unresolvable skill" trigger:** The edit command at `edit.tsx:242-246` exits early with "No changes made" if skills are unchanged. To force the full edit flow (config write + agent recompilation), include `web-styling-tailwind` in the config — a skill NOT in the E2E source. The wizard drops it, creating a "removed" change that triggers the full flow.

**Bug B test technique — dual HOME isolation:** Both tests set `HOME=<tempHOME>` separate from the project dir. This allows verifying that:

- Global config at `<HOME>/.claude-src/config.ts` is written/preserved correctly
- Project config at `<projectDir>/.claude-src/config.ts` doesn't leak global items
- Global agents at `<HOME>/.claude/agents/` are routed correctly
- No cross-contamination between scope directories

**Phase 6 Learnings:** 10. **`loadProjectConfig()` does NOT merge scopes:** It loads ONLY one config — project first, global fallback (`project-config.ts:75-86`). The edit command never sees both configs simultaneously. 11. **`selectedAgents` in config prevents scope reset:** Without `selectedAgents`, `preselectAgentsFromDomains()` in `use-wizard-initialization.ts:48-53` resets all agent scopes to "global". Including `selectedAgents` preserves the intended scope assignment. 12. **`--agent-source` flag needed for E2E agents:** The recompile step needs to find agent definitions. Without `--agent-source` pointing to the E2E source, the CLI loads built-in agents which don't include the test agents.

**Phase 7: Additional Uninstall Scenarios — COMPLETE (3 tests)**

| File                                        | Tests                                   | Status  |
| ------------------------------------------- | --------------------------------------- | ------- |
| `e2e/commands/plugin-uninstall.e2e.test.ts` | +2 (P-UNINSTALL-2) +1 (CLI unavailable) | Passing |

**P-UNINSTALL-2 (preserves non-CLI plugins):** Two tests verify that `enabledPlugins` entries NOT matching config skills survive uninstall. The `cliPluginNames` intersection at `uninstall.tsx:88` correctly filters to only config-tracked plugins. Manual entries remain in settings.json.

**P-UNINSTALL-3-ALT (CLI unavailable):** Uses `PATH: [nodeDir, "/usr/bin", "/bin"]` to exclude `claude` from PATH. Verifies uninstall completes (exit 0), removes local skills/agents, and produces no errors about missing CLI. The `if (cliAvailable)` guard at `uninstall.tsx:307` correctly skips `claudePluginUninstall()` calls.

**Phase 8: Previously Deferred Scenarios — COMPLETE (3 tests)**

| File                                             | Tests                       | Status  |
| ------------------------------------------------ | --------------------------- | ------- |
| `e2e/interactive/edit-wizard-plugin.e2e.test.ts` | +1 (P-EDIT-3) +1 (P-EDIT-4) | Passing |
| `e2e/interactive/init-wizard-plugin.e2e.test.ts` | +1 (P-INIT-6)               | Passing |

**P-EDIT-3 (local → plugin migration):** Creates a local project with `createLocalProjectWithMarketplace()` helper. Navigates Sources step: Arrow Down to "Customize skill sources" → Enter → press `p` hotkey (bulk set all to plugin) → Enter. Verifies migration message in output and config updated with marketplace source.

**P-EDIT-4 (plugin → local migration):** Uses existing `createPluginProject()`. Same Sources step navigation but presses `l` hotkey instead. Verifies "Switching...to local" message, skill copied to `.claude/skills/` via `verifySkillCopiedLocally()`, and plugin uninstall triggered.

**P-INIT-6 (mixed install mode):** Navigates the init wizard with the Sources customize view. Sets first skill to "local" via Spacebar while leaving others as plugin. Verifies `deriveInstallMode()` returns "mixed" which falls through to `installLocalMode()` — output shows "Local (copy to .claude/skills/)" and all skills are copied locally regardless of source.

**Phase 8 Learnings:** 13. **`L`/`P` hotkeys are reliable for mode migration:** Bulk source switching via hotkeys avoids fragile per-skill SourceGrid column navigation. The hotkeys call `setAllSourcesLocal()`/`setAllSourcesPlugin()` on the wizard store directly. 14. **`waitForText("set all local")` confirms Sources customize view:** The hotkey footer text rendered by `step-sources.tsx` is a reliable marker that the SourceGrid has rendered. 15. **P-EDIT-5 (marketplace A→B) is a code gap, not a test gap:** `edit.tsx:323-332` only handles `change.from === "local"` — non-local→non-local source changes are silently ignored. No test can verify behavior that doesn't exist. 16. ~~**Cross-scope editing has no UX path**~~ **CORRECTED:** The `GlobalConfigPrompt` in `init.tsx` IS the UX path. When running `cc init` from a project dir with an existing global installation, the CLI asks "Edit global installation" vs "Create new project installation". Selecting "Edit global" launches the edit wizard targeting the global config. This was missed in earlier investigation.

**Phase 9: Cross-Scope Lifecycle — COMPLETE (1 test)**

| File                                              | Tests                       | Status          |
| ------------------------------------------------- | --------------------------- | --------------- |
| `e2e/lifecycle/cross-scope-lifecycle.e2e.test.ts` | 1 (3 phases, 14 assertions) | Passing (~9.4s) |

**Test flow:**

1. Phase 1: Init globally from `<HOME>` — verify config, agents, skills created
2. Phase 2: Run `init` from `<HOME>/project/` — `GlobalConfigPrompt` renders "global installation was found", select "Edit global installation" (first option, Enter), navigate the edit wizard through 3 domains (Web, API, Shared)
3. Phase 3: Verify global config/agents preserved, NO project-level config or agents created

**Phase 9 Learnings:** 17. **`GlobalConfigPrompt` is the cross-scope UX:** Running `init` from a project dir when a global config exists triggers the prompt. "Edit global installation" delegates to the edit command targeting the global config. No `--scope` flag needed. 18. **Multi-domain build navigation differs from single-domain:** `navigateEditWizardToCompletion()` presses Enter once for the Build step, which only works for single-domain configs (web only). Multi-domain configs (web + api + shared) need one Enter per domain. The cross-scope test navigates each domain individually. 19. **No bugs found in the edit-global-from-project flow:** Global config preserved correctly, no leakage into project directory. The `GlobalConfigPrompt` → edit delegation works as expected.

**Phase 10: Plugin Scope Lifecycle — Agent Content & Scope Verification — COMPLETE (1 test, FAILING — exposes 3 bugs)**

| File                                               | Tests                        | Status                                            |
| -------------------------------------------------- | ---------------------------- | ------------------------------------------------- |
| `e2e/lifecycle/plugin-scope-lifecycle.e2e.test.ts` | 1 (3 phases, ~27 assertions) | **FAILING — 11 assertions fail, exposing 3 bugs** |

**Test flow:**

1. Phase 1: Init with `--source` plugin source. Toggle web-framework-react to global scope (`S` on Build step). Toggle web-developer agent to global scope (`S` on Agents step). Complete.
2. Phase 2: Strict assertions on agent scope routing (must be in correct directory), config scope split (correct agents in correct config), and compiled agent content (correct skills per agent).
3. Phase 3: Run `compile --source` non-interactively, re-verify scope routing and agent content preserved.

**Bugs exposed:**

1. **Scope routing inverted:** After toggling web-developer to global with `S`, it ends up in the project agents dir instead of `<HOME>/.claude/agents/`. api-developer (not toggled) ends up in the global agents dir. The toggle either doesn't fire, the focus is wrong, or `splitConfigByScope()`/`writeScopedConfigs()` swaps the assignment.

2. **Agent skill cross-contamination:** web-developer.md contains `api-framework-hono` (web agent should NOT have API skills). api-developer.md does NOT contain `api-framework-hono` (API agent should have it). The stack skill→agent mapping is incorrect during compilation.

3. **Config scope split mismatch:** Global config's `selectedAgents` includes `api-developer` but NOT `web-developer`. Expected the opposite based on the `S` toggle.

**Phase 10 Learnings:** 20. **"Resilient" assertions mask bugs.** The initial test used `exists || exists` fallback logic to pass regardless of where agents landed. Strict assertions (`MUST be here, MUST NOT be there`) immediately exposed scope routing inversion. 21. **The `S` hotkey toggle may not be reaching the intended target.** The focus position on the Agents step may not be on `web-developer` when `S` is pressed. Need to investigate focus management in `step-agents.tsx`. 22. **Stack skill routing needs investigation.** The compiled agents have incorrect skill assignments — this may be independent of the scope toggle bug.

**Phase 11: Dual-Scope Edit Lifecycle — COMPLETE (9 tests, 7 expected-fail)**

| File                                        | Tests                          | Status   |
| ------------------------------------------- | ------------------------------ | -------- |
| `e2e/lifecycle/dual-scope-edit.e2e.test.ts` | 9 (7 expected-fail, 2 passing) | Complete |

**Spec:** `todo/e2e-dual-scope-edit-spec.md`

**Test flow:** Every test follows a 4-phase pattern:

- **Phase A:** Init globally from `<HOME>` (all skills global-scoped, default)
- **Phase B:** Init project from `<HOME>/project/` via GlobalConfigPrompt → "Create new project installation" (Arrow Down + Enter). Selects API domain skills + api-developer agent.
- **Phase C:** Edit from project dir — each test makes one specific change
- **Phase D:** Verify configs, agents, skills for the expected result

**Test breakdown:**

| #   | Test                                                      | Status            | Bug exposed                                                             |
| --- | --------------------------------------------------------- | ----------------- | ----------------------------------------------------------------------- |
| 1   | Global items locked, project items editable (display)     | **expected-fail** | Scope indicators (G/P prefixes, [G]/[P] badges) not rendering in output |
| 2   | Toggle project skill scope to global (S hotkey)           | **expected-fail** | Scope routing: skill ends up in wrong config after toggle               |
| 3   | Toggle project agent scope to global (S hotkey)           | **expected-fail** | Agent file routed to wrong directory after scope toggle                 |
| 4   | Local → plugin source change (Sources customize)          | **expected-fail** | Local skill files not removed after source switch to plugin             |
| 5   | Plugin → local source change (Sources customize)          | **PASSING**       | —                                                                       |
| 6   | Compiled agents contain only assigned skills              | **expected-fail** | Agent skill cross-contamination between web-developer and api-developer |
| 7   | Config split preserves source fields after edit           | **expected-fail** | Source fields lost or defaulted during splitConfigByScope()             |
| 8   | Mixed source coexistence (plugin + local in same project) | **PASSING**       | —                                                                       |
| 9   | Agent compilation from mixed-source skills                | **expected-fail** | Plugin-mode compilation produces empty preloadedSkills list             |

**Bugs discovered:**

1. **Local skill path resolution (skill-copier.ts:214-215):** Uses `process.cwd()` instead of discovery directory. When Phase A installs locally to HOME and Phase B runs from project dir, the copier looks for skills at `<projectDir>/.claude/skills/` instead of `<HOME>/.claude/skills/`. Blocks Tests 1-3, 6-7.

2. **Source switch doesn't delete local files (Test 4):** After switching from local to plugin via Sources customize view, local skill files still exist on disk.

3. **Plugin-mode compilation produces empty skill content (Test 9):** Compiled agent .md files are missing skill references. `preloadedSkills` list is empty when compiling from plugin source.

**Phase 11 Learnings:** 23. **Dual-scope init requires domain deselection or the "a" accept-all path.** The `initGlobal()` helper uses "a" to accept all stack defaults, which creates all skills as global-scoped. `initProject()` uses the GlobalConfigPrompt → "Create new project" → selects API domain specifically. 24. **`waitForRaw()` custom helper needed.** The `waitForText()` helper strips ANSI codes, but scope indicators may be rendered as ANSI-colored prefixes. A `waitForRaw()` alternative was added for raw output matching. 25. **The `it.fails` pattern works well for known-bug exposure.** 7 of 9 tests expose real bugs via strict assertions. When bugs are fixed, these tests will start failing (because the expected failure no longer occurs), signaling that the `it.fails` wrapper should be removed.

---

### Deferred Test Scenarios

The following scenarios from the design documents are deferred and NOT implemented:

| Scenario                                     | Reason                                                                                                                   | Source      |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | ----------- |
| P-EDIT-5: Source change marketplace A → B    | Current code doesn't handle non-local→non-local source changes (edit.tsx:323-332 only handles `change.from === "local"`) | Section 5   |
| Bug C: Domain duplication across edits       | Deferred per user                                                                                                        | Section 4.3 |
| P-INIT-5: Partial installation failure       | Requires simulating a mid-install failure; not a priority since installs usually succeed                                 | Section 4.1 |
| ~~Full cross-scope lifecycle (Section 3.1)~~ | **IMPLEMENTED** — `GlobalConfigPrompt` in init provides the UX path. See Phase 9.                                        | Section 8   |
| Multiple marketplaces, --refresh             | Advanced scenarios requiring multiple source registrations                                                               | Section 5   |

---

### Final Summary

**Total E2E test count: 62 tests across 13 test files (8 expected-fail)**

| Phase       | File                                               | Tests                          |
| ----------- | -------------------------------------------------- | ------------------------------ |
| 1           | `e2e/blockers/plugin-chain-poc.e2e.test.ts`        | 5                              |
| 1           | `e2e/blockers/home-isolation.e2e.test.ts`          | 4                              |
| 2           | `e2e/commands/plugin-build.e2e.test.ts`            | 8                              |
| 2           | `e2e/commands/plugin-uninstall.e2e.test.ts`        | 15                             |
| 3           | `e2e/interactive/init-wizard-plugin.e2e.test.ts`   | 7                              |
| 4           | `e2e/interactive/edit-wizard-plugin.e2e.test.ts`   | 8                              |
| 5           | `e2e/lifecycle/local-lifecycle.e2e.test.ts`        | 1                              |
| 5           | `e2e/lifecycle/plugin-lifecycle.e2e.test.ts`       | 1                              |
| 6           | `e2e/bugs/edit-skill-accumulation.e2e.test.ts`     | 1                              |
| 6           | `e2e/bugs/edit-agent-scope-routing.e2e.test.ts`    | 1                              |
| 9           | `e2e/lifecycle/cross-scope-lifecycle.e2e.test.ts`  | 1                              |
| 10          | `e2e/lifecycle/plugin-scope-lifecycle.e2e.test.ts` | 1 (expected-fail)              |
| 11          | `e2e/lifecycle/dual-scope-edit.e2e.test.ts`        | 9 (7 expected-fail, 2 passing) |
| **Helpers** | `e2e/helpers/create-e2e-plugin-source.ts`          | —                              |
| **Helpers** | `e2e/helpers/plugin-assertions.ts` (7 functions)   | —                              |
| **Total**   |                                                    | **62**                         |

---

### Quality Audit & Fixes (2026-03-13)

An audit of all 10 test files identified 12 quality issues. Four high-impact fixes were implemented:

1. **Consolidated `navigateEditWizardToCompletion()`** — extracted from `edit-skill-accumulation.e2e.test.ts` and `edit-agent-scope-routing.e2e.test.ts` into `e2e/helpers/test-utils.ts`. Takes explicit `timeoutMs` parameter (default 30s) passed to all `waitForText()` calls. Prevents navigation desync from timeout defaults.

2. **Regex lower bounds** — changed `\d+` to `[1-9]\d*` in output assertions in `local-lifecycle.e2e.test.ts` (`Recompiled [1-9]\d* global agents`) and `plugin-build.e2e.test.ts` (`Marketplace generated with [1-9]\d* plugins`). Prevents false passes when 0 items are compiled.

3. **Exact agent count** — changed `expect(mdFiles.length).toBeGreaterThan(0)` to `expect(mdFiles.length).toBe(2)` in `local-lifecycle.e2e.test.ts`. The E2E source defines exactly 2 agents (web-developer, api-developer).

4. **Timeout propagation** — all `waitForText()` calls in bug reproduction tests now receive explicit timeouts via the shared helper.

**Remaining audit items (not fixed, lower priority):**

- Output timing race in TerminalSession (getRawOutput after waitForExit may miss late PTY data)
- `verifyConfig()` in plugin-assertions.ts uses loose `content.includes(id)` instead of JSON structure validation
- `navigateToCompletion()` in edit-wizard-plugin.e2e.test.ts still local (different navigation context)
- No assertion on plugin registry state after uninstall in plugin-uninstall.e2e.test.ts
