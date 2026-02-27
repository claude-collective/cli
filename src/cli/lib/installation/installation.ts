import os from "os";
import path from "path";
import { fileExists } from "../../utils/fs";
import { loadProjectConfigFromDir } from "../configuration/project-config";
import {
  CLAUDE_DIR,
  CLAUDE_SRC_DIR,
  CLI_BIN_NAME,
  DEFAULT_BRANDING,
  PLUGINS_SUBDIR,
  STANDARD_FILES,
} from "../../consts";

export type InstallMode = "local" | "plugin";

export type InstallScope = "project" | "global";

export type Installation = {
  mode: InstallMode;
  scope: InstallScope;
  configPath: string;
  agentsDir: string;
  skillsDir: string;
  projectDir: string;
};

/** Detect installation in a specific directory only (no global fallback). */
export async function detectProjectInstallation(projectDir: string): Promise<Installation | null> {
  const srcConfigPath = path.join(projectDir, CLAUDE_SRC_DIR, STANDARD_FILES.CONFIG_YAML);
  const legacyConfigPath = path.join(projectDir, CLAUDE_DIR, STANDARD_FILES.CONFIG_YAML);

  const localConfigPath = (await fileExists(srcConfigPath))
    ? srcConfigPath
    : (await fileExists(legacyConfigPath))
      ? legacyConfigPath
      : null;

  if (!localConfigPath) {
    return null;
  }

  // Use loadProjectConfigFromDir to avoid circular global fallback
  const loaded = await loadProjectConfigFromDir(projectDir);

  const mode: InstallMode = loaded?.config?.installMode ?? "local";

  if (mode === "local") {
    return {
      mode: "local",
      scope: "project",
      configPath: localConfigPath,
      agentsDir: path.join(projectDir, CLAUDE_DIR, "agents"),
      skillsDir: path.join(projectDir, CLAUDE_DIR, "skills"),
      projectDir,
    };
  }

  // Skills live in global plugin cache; agents compiled locally
  return {
    mode: "plugin",
    scope: "project",
    configPath: localConfigPath,
    agentsDir: path.join(projectDir, CLAUDE_DIR, "agents"),
    skillsDir: path.join(projectDir, CLAUDE_DIR, PLUGINS_SUBDIR),
    projectDir,
  };
}

/** Detect installation in the home directory (global scope). */
async function detectGlobalInstallation(): Promise<Installation | null> {
  const homeDir = os.homedir();
  const srcConfigPath = path.join(homeDir, CLAUDE_SRC_DIR, STANDARD_FILES.CONFIG_YAML);

  if (!(await fileExists(srcConfigPath))) {
    return null;
  }

  // Use loadProjectConfigFromDir directly to avoid recursion
  const loaded = await loadProjectConfigFromDir(homeDir);
  const mode: InstallMode = loaded?.config?.installMode ?? "local";

  if (mode === "local") {
    return {
      mode: "local",
      scope: "global",
      configPath: srcConfigPath,
      agentsDir: path.join(homeDir, CLAUDE_DIR, "agents"),
      skillsDir: path.join(homeDir, CLAUDE_DIR, "skills"),
      projectDir: homeDir,
    };
  }

  return {
    mode: "plugin",
    scope: "global",
    configPath: srcConfigPath,
    agentsDir: path.join(homeDir, CLAUDE_DIR, "agents"),
    skillsDir: path.join(homeDir, CLAUDE_DIR, PLUGINS_SUBDIR),
    projectDir: homeDir,
  };
}

/**
 * Detect installation: checks project-level first, then falls back to global (home directory).
 * Project fully overrides global (no merging).
 */
export async function detectInstallation(
  projectDir: string = process.cwd(),
): Promise<Installation | null> {
  // 1. Check project-level first
  const projectInstallation = await detectProjectInstallation(projectDir);
  if (projectInstallation) return projectInstallation;

  // 2. Fall back to global (home directory)
  return detectGlobalInstallation();
}

export async function getInstallationOrThrow(
  projectDir: string = process.cwd(),
): Promise<Installation> {
  const installation = await detectInstallation(projectDir);

  if (!installation) {
    throw new Error(
      `No ${DEFAULT_BRANDING.NAME} installation found.\nRun '${CLI_BIN_NAME} init' to create one.`,
    );
  }

  return installation;
}
