import { getInstallationInfo } from "../plugins/plugin-info.js";
import { loadProjectConfig } from "../configuration/project-config.js";
import { deriveInstallMode } from "../installation/index.js";

export type DashboardData = {
  skillCount: number;
  agentCount: number;
  mode: string;
  source?: string;
};

/** Gathers dashboard data from the installation and project config. */
export async function getDashboardData(projectDir: string): Promise<DashboardData> {
  const [info, loaded] = await Promise.all([getInstallationInfo(), loadProjectConfig(projectDir)]);

  // Skill count from config (canonical source of truth for installed skills)
  const skillCount = loaded?.config?.skills?.length ?? 0;
  // Agent count from filesystem (compiled .md files in agents dir)
  const agentCount = info?.agentCount ?? 0;
  const mode =
    info?.mode ?? (loaded?.config?.skills ? deriveInstallMode(loaded.config.skills) : "local");
  const source = loaded?.config?.source;

  return { skillCount, agentCount, mode, source };
}
