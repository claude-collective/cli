import { readdir } from "fs/promises";
import {
  getCollectivePluginDir,
  getPluginSkillsDir,
  getPluginAgentsDir,
  readPluginManifest,
} from "./plugin-finder";
import { directoryExists } from "../utils/fs";
import { DEFAULT_DISPLAY_VERSION } from "../consts";
import { detectInstallation, type InstallMode } from "./installation";
import { loadProjectConfig } from "./project-config";

const DEFAULT_NAME = "claude-collective";

export interface PluginInfo {
  name: string;
  version: string;
  skillCount: number;
  agentCount: number;
  path: string;
}

export interface InstallationInfo {
  mode: InstallMode;
  name: string;
  version: string;
  skillCount: number;
  agentCount: number;
  configPath: string;
  agentsDir: string;
  skillsDir: string;
}

export async function getPluginInfo(): Promise<PluginInfo | null> {
  const pluginDir = getCollectivePluginDir();

  if (!(await directoryExists(pluginDir))) {
    return null;
  }

  const manifest = await readPluginManifest(pluginDir);
  if (!manifest) {
    return null;
  }

  const skillsDir = getPluginSkillsDir(pluginDir);
  const agentsDir = getPluginAgentsDir(pluginDir);

  let skillCount = 0;
  let agentCount = 0;

  if (await directoryExists(skillsDir)) {
    const skills = await readdir(skillsDir, { withFileTypes: true });
    skillCount = skills.filter((s) => s.isDirectory()).length;
  }

  if (await directoryExists(agentsDir)) {
    const agents = await readdir(agentsDir, { withFileTypes: true });
    agentCount = agents.filter((a) => a.isFile() && a.name.endsWith(".md")).length;
  }

  return {
    name: manifest.name || DEFAULT_NAME,
    version: manifest.version || DEFAULT_DISPLAY_VERSION,
    skillCount,
    agentCount,
    path: pluginDir,
  };
}

export function formatPluginDisplay(info: PluginInfo): string {
  return `Plugin: ${info.name} v${info.version}
  Skills: ${info.skillCount}
  Agents: ${info.agentCount}
  Path:   ${info.path}`;
}

/**
 * Get installation info for either local or plugin mode.
 * Auto-detects the installation mode and returns unified info.
 */
export async function getInstallationInfo(): Promise<InstallationInfo | null> {
  const installation = await detectInstallation();

  if (!installation) {
    return null;
  }

  let skillCount = 0;
  let agentCount = 0;
  let name = DEFAULT_NAME;
  let version = DEFAULT_DISPLAY_VERSION;

  // Count skills
  if (await directoryExists(installation.skillsDir)) {
    try {
      const skills = await readdir(installation.skillsDir, {
        withFileTypes: true,
      });
      skillCount = skills.filter((s) => s.isDirectory()).length;
    } catch {
      // Ignore errors
    }
  }

  // Count agents
  if (await directoryExists(installation.agentsDir)) {
    try {
      const agents = await readdir(installation.agentsDir, {
        withFileTypes: true,
      });
      agentCount = agents.filter((a) => a.isFile() && a.name.endsWith(".md")).length;
    } catch {
      // Ignore errors
    }
  }

  // Get name/version from config or manifest depending on mode
  if (installation.mode === "local") {
    const loaded = await loadProjectConfig(installation.projectDir);
    if (loaded?.config) {
      name = loaded.config.name || DEFAULT_NAME;
      // Local mode doesn't have version in the same way
      version = "local";
    }
  } else {
    // Plugin mode - read from manifest
    const pluginDir = getCollectivePluginDir(installation.projectDir);
    const manifest = await readPluginManifest(pluginDir);
    if (manifest) {
      name = manifest.name || DEFAULT_NAME;
      version = manifest.version || DEFAULT_DISPLAY_VERSION;
    }
  }

  return {
    mode: installation.mode,
    name,
    version,
    skillCount,
    agentCount,
    configPath: installation.configPath,
    agentsDir: installation.agentsDir,
    skillsDir: installation.skillsDir,
  };
}

export function formatInstallationDisplay(info: InstallationInfo): string {
  const modeLabel = info.mode === "local" ? "Local" : "Plugin";
  const versionDisplay = info.mode === "local" ? "(local mode)" : `v${info.version}`;

  return `Installation: ${info.name} ${versionDisplay}
  Mode:    ${modeLabel}
  Skills:  ${info.skillCount}
  Agents:  ${info.agentCount}
  Config:  ${info.configPath}
  Agents:  ${info.agentsDir}`;
}
