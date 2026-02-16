import path from "path";
import { fileExists } from "../../utils/fs";
import { loadProjectConfig } from "../configuration";
import { CLAUDE_DIR, CLAUDE_SRC_DIR, STANDARD_FILES } from "../../consts";

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

  // Plugin mode with individual skill plugins
  // Skills are in global cache, discovered via settings.json
  // Agents are compiled locally to .claude/agents/
  return {
    mode: "plugin",
    configPath: localConfigPath,
    agentsDir: path.join(projectDir, CLAUDE_DIR, "agents"),
    skillsDir: path.join(projectDir, CLAUDE_DIR, "plugins"),
    projectDir,
  };
}

export async function getInstallationOrThrow(
  projectDir: string = process.cwd(),
): Promise<Installation> {
  const installation = await detectInstallation(projectDir);

  if (!installation) {
    throw new Error("No Claude Collective installation found.\nRun 'cc init' to create one.");
  }

  return installation;
}
