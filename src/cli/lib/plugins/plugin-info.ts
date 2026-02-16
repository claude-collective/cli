import { readdir } from "fs/promises";

import { DEFAULT_DISPLAY_VERSION, DEFAULT_PLUGIN_NAME } from "../../consts";
import { directoryExists } from "../../utils/fs";
import { verbose } from "../../utils/logger";
import { loadProjectConfig } from "../configuration";
import { detectInstallation, type InstallMode } from "../installation";
import { getProjectPluginsDir } from "./plugin-finder";
import { discoverAllPluginSkills, listPluginNames } from "./plugin-discovery";

export type PluginInfo = {
  name: string;
  version: string;
  skillCount: number;
  agentCount: number;
  path: string;
};

export type InstallationInfo = {
  mode: InstallMode;
  name: string;
  version: string;
  skillCount: number;
  agentCount: number;
  configPath: string;
  agentsDir: string;
  skillsDir: string;
};

export async function getPluginInfo(projectDir?: string): Promise<PluginInfo | null> {
  const dir = projectDir ?? process.cwd();

  try {
    const pluginNames = await listPluginNames(dir);
    if (pluginNames.length > 0) {
      return {
        name: DEFAULT_PLUGIN_NAME,
        version: DEFAULT_DISPLAY_VERSION,
        skillCount: pluginNames.length,
        agentCount: 0,
        path: getProjectPluginsDir(dir),
      };
    }
  } catch {
    verbose("Failed to list plugins for plugin info");
  }

  return null;
}

export function formatPluginDisplay(info: PluginInfo): string {
  return `Plugin: ${info.name} v${info.version}
  Skills: ${info.skillCount}
  Agents: ${info.agentCount}
  Path:   ${info.path}`;
}

export async function getInstallationInfo(): Promise<InstallationInfo | null> {
  const installation = await detectInstallation();

  if (!installation) {
    return null;
  }

  let skillCount = 0;
  let agentCount = 0;
  let name = DEFAULT_PLUGIN_NAME;
  let version = DEFAULT_DISPLAY_VERSION;

  if (installation.mode === "plugin") {
    // Plugin mode: discover skills via settings.json and global cache
    try {
      const pluginSkills = await discoverAllPluginSkills(installation.projectDir);
      skillCount = Object.keys(pluginSkills).length;
    } catch {
      // Ignore errors
    }
  } else if (await directoryExists(installation.skillsDir)) {
    try {
      const skills = await readdir(installation.skillsDir, {
        withFileTypes: true,
      });
      skillCount = skills.filter((s) => s.isDirectory()).length;
    } catch {
      // Ignore errors
    }
  }

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

  const loaded = await loadProjectConfig(installation.projectDir);
  if (loaded?.config) {
    name = loaded.config.name || DEFAULT_PLUGIN_NAME;
    version = installation.mode === "local" ? "local" : "plugin";
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
