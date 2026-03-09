import { loadProjectSourceConfig, writeProjectSourceConfig } from "./config";

export async function saveSourceToProjectConfig(projectDir: string, source: string): Promise<void> {
  const existing = (await loadProjectSourceConfig(projectDir)) ?? {};
  await writeProjectSourceConfig(projectDir, { ...existing, source });
}
