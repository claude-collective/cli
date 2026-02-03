/**
 * Installation detection utilities for Claude Collective.
 *
 * Detects whether a project uses local mode (.claude-src/config.yaml) or
 * plugin mode (.claude/plugins/claude-collective/).
 */
import path from "path";
import { directoryExists, fileExists } from "../utils/fs";
import { loadProjectConfig } from "./project-config";
import { getCollectivePluginDir } from "./plugin-finder";
import { CLAUDE_DIR, CLAUDE_SRC_DIR } from "../consts";

export type InstallMode = "local" | "plugin";

export interface Installation {
  mode: InstallMode;
  configPath: string;
  agentsDir: string;
  skillsDir: string;
  projectDir: string;
}

/**
 * Detect the current installation mode by checking for local config first.
 * Priority: Local (.claude-src/config.yaml with installMode: local) > Plugin
 */
export async function detectInstallation(
  projectDir: string = process.cwd(),
): Promise<Installation | null> {
  // 1. Check for local installation first
  // Check .claude-src/config.yaml first (new location)
  const srcConfigPath = path.join(projectDir, CLAUDE_SRC_DIR, "config.yaml");
  // Fall back to .claude/config.yaml (legacy location)
  const legacyConfigPath = path.join(projectDir, CLAUDE_DIR, "config.yaml");

  const localConfigPath = (await fileExists(srcConfigPath))
    ? srcConfigPath
    : (await fileExists(legacyConfigPath))
      ? legacyConfigPath
      : null;

  if (localConfigPath) {
    const loaded = await loadProjectConfig(projectDir);

    // If config exists and has installMode: local (or no installMode, defaults to local)
    // treat it as local mode
    const mode: InstallMode = loaded?.config?.installMode ?? "local";

    if (mode === "local") {
      return {
        mode: "local",
        configPath: localConfigPath,
        agentsDir: path.join(projectDir, CLAUDE_DIR, "agents"),
        skillsDir: path.join(projectDir, CLAUDE_DIR, "skills"),
        projectDir,
      };
    }
  }

  // 2. Check for plugin installation
  const pluginDir = getCollectivePluginDir(projectDir);
  const pluginConfigPath = path.join(pluginDir, "config.yaml");

  if (await directoryExists(pluginDir)) {
    return {
      mode: "plugin",
      configPath: pluginConfigPath,
      agentsDir: path.join(pluginDir, "agents"),
      skillsDir: path.join(pluginDir, "skills"),
      projectDir,
    };
  }

  // No installation found
  return null;
}

/**
 * Get installation or throw with helpful error message
 */
export async function getInstallationOrThrow(
  projectDir: string = process.cwd(),
): Promise<Installation> {
  const installation = await detectInstallation(projectDir);

  if (!installation) {
    throw new Error(
      "No Claude Collective installation found.\n" +
        "Run 'cc init' to create one.",
    );
  }

  return installation;
}
