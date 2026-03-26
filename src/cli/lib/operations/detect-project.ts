import { detectInstallation, type Installation } from "../installation/index.js";
import { loadProjectConfig } from "../configuration/index.js";
import type { ProjectConfig } from "../../types/index.js";

export type DetectedProject = {
  installation: Installation;
  config: ProjectConfig | null;
  configPath: string | null;
};

/**
 * Detects an existing CLI installation and loads its project config.
 *
 * Uses detectInstallation() which checks project-level first, then falls back
 * to global. Returns the installation metadata plus the loaded config.
 *
 * Does NOT throw. Returns null if no installation found.
 * Commands decide how to handle null (error out, warn, etc.).
 */
export async function detectProject(projectDir?: string): Promise<DetectedProject | null> {
  const resolvedDir = projectDir ?? process.cwd();
  const installation = await detectInstallation(resolvedDir);

  if (!installation) {
    return null;
  }

  const loaded = await loadProjectConfig(installation.projectDir);

  return {
    installation,
    config: loaded?.config ?? null,
    configPath: loaded?.configPath ?? null,
  };
}
