import path from "path";
import { readFile, readdir } from "fs/promises";
import { CLAUDE_DIR, CLAUDE_SRC_DIR, STANDARD_FILES, STANDARD_DIRS } from "../../src/cli/consts.js";
import type { SkillId } from "../../src/cli/types/index.js";
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
 * at <homeDir>/.claude/plugins/installed_plugins.json.
 *
 * When HOME is set to a temp dir (as in E2E tests), pass the temp dir as homeDir.
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
  skillId: SkillId,
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
export async function verifyAgentCompiled(
  projectDir: string,
  agentName: string,
): Promise<boolean> {
  const agentPath = path.join(projectDir, CLAUDE_DIR, "agents", `${agentName}.md`);
  if (!(await fileExists(agentPath))) return false;
  const content = await readFile(agentPath, "utf-8");
  return content.startsWith("---");
}

/**
 * Verifies config.ts was written at <projectDir>/.claude-src/config.ts
 * and checks expected properties by searching the file content.
 *
 * @throws if config.ts does not exist or expectations are not met
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
 *
 * @throws if any skill directories are found
 */
export async function verifyNoLocalSkills(projectDir: string): Promise<void> {
  const skillsDir = path.join(projectDir, CLAUDE_DIR, STANDARD_DIRS.SKILLS);
  const exists = await directoryExists(skillsDir);
  if (exists) {
    const entries = await readdir(skillsDir);
    if (entries.length > 0) {
      throw new Error(`Expected no local skills but found: ${entries.join(", ")}`);
    }
  }
}

/**
 * Asserts no plugins are enabled in <projectDir>/.claude/settings.json.
 *
 * @throws if any plugins are enabled (value === true)
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
