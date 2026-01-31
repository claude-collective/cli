import { readdir } from "fs/promises";
import {
  getCollectivePluginDir,
  getPluginSkillsDir,
  getPluginAgentsDir,
  readPluginManifest,
} from "./plugin-finder";
import { directoryExists } from "../utils/fs";
import { DEFAULT_DISPLAY_VERSION } from "../consts";

const DEFAULT_NAME = "claude-collective";

export interface PluginInfo {
  name: string;
  version: string;
  skillCount: number;
  agentCount: number;
  path: string;
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
    agentCount = agents.filter(
      (a) => a.isFile() && a.name.endsWith(".md"),
    ).length;
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
