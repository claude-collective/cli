import path from "path";
import { fileExists } from "../../utils/fs";
import { loadProjectConfig } from "../configuration";
import {
  CLAUDE_DIR,
  CLAUDE_SRC_DIR,
  DEFAULT_BRANDING,
  PLUGINS_SUBDIR,
  STANDARD_FILES,
} from "../../consts";

export type InstallMode = "local" | "plugin";

export type Installation = {
  mode: InstallMode;
  configPath: string;
  agentsDir: string;
  skillsDir: string;
  projectDir: string;
};

export async function detectInstallation(
  projectDir: string = process.cwd(),
): Promise<Installation | null> {
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

  const loaded = await loadProjectConfig(projectDir);

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

  // Skills live in global plugin cache; agents compiled locally
  return {
    mode: "plugin",
    configPath: localConfigPath,
    agentsDir: path.join(projectDir, CLAUDE_DIR, "agents"),
    skillsDir: path.join(projectDir, CLAUDE_DIR, PLUGINS_SUBDIR),
    projectDir,
  };
}

export async function getInstallationOrThrow(
  projectDir: string = process.cwd(),
): Promise<Installation> {
  const installation = await detectInstallation(projectDir);

  if (!installation) {
    throw new Error(
      `No ${DEFAULT_BRANDING.NAME} installation found.\nRun 'cc init' to create one.`,
    );
  }

  return installation;
}
