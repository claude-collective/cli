import path from "path";
import { readdir } from "fs/promises";
import { directoryExists, listDirectories, remove } from "../../utils/fs.js";
import { claudePluginUninstall, isClaudeCLIAvailable } from "../../utils/exec.js";
import { listPluginNames, getProjectPluginsDir } from "../plugins/index.js";
import { readForkedFromMetadata } from "../skills/index.js";
import { loadProjectConfigFromDir } from "../configuration/project-config.js";
import { getErrorMessage } from "../../utils/errors.js";
import { CLAUDE_DIR, CLAUDE_SRC_DIR } from "../../consts.js";
import type { ProjectConfig } from "../../types/index.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type UninstallTarget = {
  hasPlugins: boolean;
  pluginNames: string[];
  /** Plugin names filtered to only those installed by this CLI (matched against config skills) */
  cliPluginNames: string[];
  hasLocalSkills: boolean;
  hasLocalAgents: boolean;
  hasClaudeDir: boolean;
  hasClaudeSrcDir: boolean;
  pluginsDir: string;
  skillsDir: string;
  agentsDir: string;
  claudeDir: string;
  claudeSrcDir: string;
  /** Resolved project source config from .claude-src/config.ts */
  config: Partial<ProjectConfig> | null;
  /** Agent names from the generated config (e.g., ["web-developer"]) */
  configuredAgents: string[];
};

export type SkillRemovalResult = {
  removedCount: number;
  skippedCount: number;
  removedNames: string[];
  skippedNames: string[];
  /** Whether the skills directory was cleaned up (empty after removal) */
  dirCleaned: boolean;
};

export type AgentRemovalResult = {
  removedCount: number;
  removedNames: string[];
  /** Whether the agents directory was cleaned up (empty after removal) */
  dirCleaned: boolean;
};

export type UninstallPluginsResult = {
  uninstalledNames: string[];
  totalUninstalled: number;
};

export type CleanupResult = {
  claudeDirRemoved: boolean;
  claudeSrcDirRemoved: boolean;
  /** Whether .claude/ still exists with user content after cleanup */
  claudeDirKept: boolean;
};

// ---------------------------------------------------------------------------
// detectUninstallTarget
// ---------------------------------------------------------------------------

function collectConfiguredAgents(config: Partial<ProjectConfig> | null): string[] {
  if (!config?.agents) return [];
  return config.agents.map((a) => a.name);
}

function getCliInstalledPluginKeys(config: Partial<ProjectConfig> | null): Set<string> {
  if (!config?.skills) return new Set();
  return new Set(config.skills.map((skill) => `${skill.id}@${skill.source}`));
}

/**
 * Detects what's installed in a project directory for uninstallation.
 *
 * Checks for plugins, local skills, agents, config directories, and
 * resolves which plugins were installed by this CLI.
 */
export async function detectUninstallTarget(projectDir: string): Promise<UninstallTarget> {
  const pluginsDir = getProjectPluginsDir(projectDir);
  const skillsDir = path.join(projectDir, CLAUDE_DIR, "skills");
  const agentsDir = path.join(projectDir, CLAUDE_DIR, "agents");
  const claudeDir = path.join(projectDir, CLAUDE_DIR);
  const claudeSrcDir = path.join(projectDir, CLAUDE_SRC_DIR);

  const [hasLocalSkills, hasLocalAgents, hasClaudeDir, hasClaudeSrcDir, config] = await Promise.all(
    [
      directoryExists(skillsDir),
      directoryExists(agentsDir),
      directoryExists(claudeDir),
      directoryExists(claudeSrcDir),
      loadProjectConfigFromDir(projectDir).then((result) => result?.config ?? null),
    ],
  );

  let pluginNames: string[] = [];
  try {
    pluginNames = await listPluginNames(projectDir);
  } catch {
    // Best-effort: plugin detection may fail
  }

  const configuredAgents = collectConfiguredAgents(config);
  const cliInstalledKeys = getCliInstalledPluginKeys(config);
  const cliPluginNames = pluginNames.filter((name) => cliInstalledKeys.has(name));

  return {
    hasPlugins: cliPluginNames.length > 0,
    pluginNames,
    cliPluginNames,
    hasLocalSkills,
    hasLocalAgents,
    hasClaudeDir,
    hasClaudeSrcDir,
    pluginsDir,
    skillsDir,
    agentsDir,
    claudeDir,
    claudeSrcDir,
    config,
    configuredAgents,
  };
}

// ---------------------------------------------------------------------------
// removeMatchingSkills
// ---------------------------------------------------------------------------

function shouldRemoveSkill(forkedFrom: { source?: string } | null): boolean {
  return forkedFrom !== null;
}

/**
 * Removes local skills that were installed by the CLI (have forked-from metadata).
 *
 * Scans the skills directory, checks each skill for CLI-installed metadata,
 * and removes matching skills. User-created skills (without metadata) are preserved.
 *
 * @param onRemoved - Called for each removed skill directory name (for logging)
 * @param onSkipped - Called for each skipped skill directory name (for logging)
 */
export async function removeMatchingSkills(
  target: Pick<UninstallTarget, "hasLocalSkills" | "skillsDir">,
  onRemoved?: (dirName: string) => void,
  onSkipped?: (dirName: string) => void,
): Promise<SkillRemovalResult> {
  if (!target.hasLocalSkills) {
    return { removedCount: 0, skippedCount: 0, removedNames: [], skippedNames: [], dirCleaned: false };
  }

  const skillDirNames = await listDirectories(target.skillsDir);
  const removedNames: string[] = [];
  const skippedNames: string[] = [];

  for (const skillDirName of skillDirNames) {
    const skillDir = path.join(target.skillsDir, skillDirName);
    const forkedFrom = await readForkedFromMetadata(skillDir);

    if (shouldRemoveSkill(forkedFrom)) {
      await remove(skillDir);
      removedNames.push(skillDirName);
      onRemoved?.(skillDirName);
    } else {
      skippedNames.push(skillDirName);
      onSkipped?.(skillDirName);
    }
  }

  let dirCleaned = false;
  if (skippedNames.length === 0 && (await directoryExists(target.skillsDir))) {
    if (await isDirectoryEmpty(target.skillsDir)) {
      await remove(target.skillsDir);
      dirCleaned = true;
    }
  }

  return {
    removedCount: removedNames.length,
    skippedCount: skippedNames.length,
    removedNames,
    skippedNames,
    dirCleaned,
  };
}

// ---------------------------------------------------------------------------
// removeMatchingAgents
// ---------------------------------------------------------------------------

/**
 * Removes compiled agent .md files that match configured agent names.
 *
 * Only removes agents that are listed in the project config (CLI-compiled).
 * Cleans up the agents directory if empty after removal.
 *
 * @param onRemoved - Called for each removed agent name (for logging)
 */
export async function removeMatchingAgents(
  target: Pick<UninstallTarget, "hasLocalAgents" | "agentsDir" | "configuredAgents">,
  onRemoved?: (agentName: string) => void,
): Promise<AgentRemovalResult> {
  if (!target.hasLocalAgents) {
    return { removedCount: 0, removedNames: [], dirCleaned: false };
  }

  if (target.configuredAgents.length === 0) {
    return { removedCount: 0, removedNames: [], dirCleaned: false };
  }

  const agentFiles = await listAgentFiles(target.agentsDir);
  const removedNames: string[] = [];

  for (const agentFile of agentFiles) {
    const agentName = agentFile.replace(/\.md$/, "");
    if (!target.configuredAgents.includes(agentName)) continue;

    await remove(path.join(target.agentsDir, agentFile));
    removedNames.push(agentName);
    onRemoved?.(agentName);
  }

  let dirCleaned = false;
  if (await directoryExists(target.agentsDir)) {
    if (await isDirectoryEmpty(target.agentsDir)) {
      await remove(target.agentsDir);
      dirCleaned = true;
    }
  }

  return {
    removedCount: removedNames.length,
    removedNames,
    dirCleaned,
  };
}

// ---------------------------------------------------------------------------
// uninstallPlugins
// ---------------------------------------------------------------------------

/**
 * Uninstalls CLI-managed plugins by removing them from the Claude CLI
 * and deleting their local directories.
 *
 * Derives scope from per-skill config when available; falls back to project-level.
 *
 * @param onUninstalled - Called for each successfully uninstalled plugin name (for logging)
 */
export async function uninstallPlugins(
  target: Pick<UninstallTarget, "hasPlugins" | "cliPluginNames" | "pluginsDir" | "config">,
  projectDir: string,
  onUninstalled?: (pluginName: string) => void,
): Promise<UninstallPluginsResult> {
  if (!target.hasPlugins) {
    return { uninstalledNames: [], totalUninstalled: 0 };
  }

  const cliAvailable = await isClaudeCLIAvailable();
  const uninstalledNames: string[] = [];

  for (const pluginName of target.cliPluginNames) {
    if (cliAvailable) {
      try {
        // Derive scope from per-skill config; fall back to project-level heuristic
        const skillId = pluginName.split("@")[0];
        const skillConfig = target.config?.skills?.find((s) => s.id === skillId);
        const pluginScope = skillConfig?.scope === "global" ? "user" : "project";
        await claudePluginUninstall(pluginName, pluginScope, projectDir);
      } catch {
        // Best-effort: plugin may not be registered with Claude CLI
      }
    }

    const pluginPath = path.join(target.pluginsDir, pluginName);
    await remove(pluginPath);
    uninstalledNames.push(pluginName);
    onUninstalled?.(pluginName);
  }

  return {
    uninstalledNames,
    totalUninstalled: uninstalledNames.length,
  };
}

// ---------------------------------------------------------------------------
// cleanupEmptyDirs
// ---------------------------------------------------------------------------

/**
 * Removes empty .claude/ and .claude-src/ directories after uninstall.
 *
 * Only removes .claude-src/ when `removeAll` is true.
 * Only removes .claude/ when it's completely empty.
 */
export async function cleanupEmptyDirs(
  target: Pick<UninstallTarget, "hasClaudeDir" | "hasClaudeSrcDir" | "claudeDir" | "claudeSrcDir">,
  removeAll: boolean,
): Promise<CleanupResult> {
  let claudeSrcDirRemoved = false;
  if (removeAll && target.hasClaudeSrcDir) {
    await remove(target.claudeSrcDir);
    claudeSrcDirRemoved = true;
  }

  let claudeDirRemoved = false;
  let claudeDirKept = false;
  if (target.hasClaudeDir && (await directoryExists(target.claudeDir))) {
    if (await isDirectoryEmpty(target.claudeDir)) {
      await remove(target.claudeDir);
      claudeDirRemoved = true;
    } else {
      claudeDirKept = true;
    }
  }

  return { claudeDirRemoved, claudeSrcDirRemoved, claudeDirKept };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function isDirectoryEmpty(dirPath: string): Promise<boolean> {
  try {
    const allEntries = await readdir(dirPath);
    return allEntries.length === 0;
  } catch {
    return true;
  }
}

async function listAgentFiles(agentsDir: string): Promise<string[]> {
  try {
    return (await readdir(agentsDir)).filter((f) => f.endsWith(".md"));
  } catch {
    return [];
  }
}
