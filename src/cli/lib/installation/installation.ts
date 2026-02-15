import path from "path";
import { directoryExists, fileExists } from "../../utils/fs";
import { loadProjectConfig } from "../configuration";
import { getCollectivePluginDir } from "../plugins";
import { CLAUDE_DIR, CLAUDE_SRC_DIR, STANDARD_FILES } from "../../consts";

export type InstallMode = "local" | "plugin";

export type Installation = {
  mode: InstallMode;
  configPath: string;
  agentsDir: string;
  skillsDir: string;
  projectDir: string;
};

// Priority: Local (.claude-src/config.yaml) > Plugin (.claude/plugins/claude-collective/)
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

  const pluginDir = getCollectivePluginDir(projectDir);
  const pluginConfigPath = path.join(pluginDir, STANDARD_FILES.CONFIG_YAML);

  if (await directoryExists(pluginDir)) {
    return {
      mode: "plugin",
      configPath: pluginConfigPath,
      agentsDir: path.join(pluginDir, "agents"),
      skillsDir: path.join(pluginDir, "skills"),
      projectDir,
    };
  }

  return null;
}

export async function getInstallationOrThrow(
  projectDir: string = process.cwd(),
): Promise<Installation> {
  const installation = await detectInstallation(projectDir);

  if (!installation) {
    throw new Error("No Claude Collective installation found.\n" + "Run 'cc init' to create one.");
  }

  return installation;
}
