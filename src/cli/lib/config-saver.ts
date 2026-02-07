import path from "path";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";
import { fileExists, readFile, writeFile, ensureDir } from "../utils/fs";
import { CLAUDE_SRC_DIR } from "../consts";

const YAML_INDENT = 2;

/**
 * Save source to project-level .claude-src/config.yaml.
 * Creates the config file if it doesn't exist, or merges with existing config.
 */
export async function saveSourceToProjectConfig(projectDir: string, source: string): Promise<void> {
  const configPath = path.join(projectDir, CLAUDE_SRC_DIR, "config.yaml");

  let config: Record<string, unknown> = {};
  if (await fileExists(configPath)) {
    const content = await readFile(configPath);
    config = (parseYaml(content) as Record<string, unknown>) || {};
  }

  config.source = source;

  await ensureDir(path.join(projectDir, CLAUDE_SRC_DIR));
  const configYaml = stringifyYaml(config, { indent: YAML_INDENT });
  await writeFile(configPath, configYaml);
}
