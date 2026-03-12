import path from "path";
import { writeFile, ensureDir } from "../../utils/fs";
import { CLAUDE_SRC_DIR } from "../../consts";
import type { ProjectConfig } from "../../types";
import { loadProjectSourceConfig, getProjectConfigPath } from "./config";
import { generateConfigSource } from "./config-writer";

export async function saveSourceToProjectConfig(
  projectDir: string,
  source: string,
  name: string,
): Promise<void> {
  const existing = (await loadProjectSourceConfig(projectDir)) ?? {};

  const config: ProjectConfig = {
    ...existing,
    name: existing.name ?? name,
    skills: existing.skills ?? [],
    agents: existing.agents ?? [],
    source,
  };

  const configPath = getProjectConfigPath(projectDir);
  await ensureDir(path.join(projectDir, CLAUDE_SRC_DIR));
  await writeFile(configPath, generateConfigSource(config));
}
