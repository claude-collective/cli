import { loadProjectSourceConfig, saveProjectConfig } from "./config";

export async function saveSourceToProjectConfig(projectDir: string, source: string): Promise<void> {
  const existing = (await loadProjectSourceConfig(projectDir)) ?? {};
  await saveProjectConfig(projectDir, { ...existing, source });
}
