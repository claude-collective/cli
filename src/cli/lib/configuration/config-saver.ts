import path from "path";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";
import { fileExists, readFile, writeFile, ensureDir } from "../../utils/fs";
import { warn } from "../../utils/logger";
import { CLAUDE_SRC_DIR, SCHEMA_PATHS, yamlSchemaComment } from "../../consts";
import { projectSourceConfigSchema } from "../schemas";

const YAML_INDENT = 2;

export async function saveSourceToProjectConfig(projectDir: string, source: string): Promise<void> {
  const configPath = path.join(projectDir, CLAUDE_SRC_DIR, "config.yaml");

  let config: Record<string, unknown> = {};
  if (await fileExists(configPath)) {
    const content = await readFile(configPath);
    try {
      const parsed = parseYaml(content);
      const result = projectSourceConfigSchema.safeParse(parsed);
      config = result.success ? (result.data as Record<string, unknown>) : {};
      if (!result.success) {
        warn(
          `Invalid config at ${configPath}: ${result.error.issues.map((i) => i.message).join(", ")}. Starting with empty config.`,
        );
      }
    } catch (error) {
      warn(
        `Failed to parse existing config at ${configPath}: ${error instanceof Error ? error.message : String(error)}. Starting with empty config.`,
      );
    }
  }

  config.source = source;

  await ensureDir(path.join(projectDir, CLAUDE_SRC_DIR));
  const schemaComment = yamlSchemaComment(SCHEMA_PATHS.projectSourceConfig) + "\n";
  const configYaml = stringifyYaml(config, { indent: YAML_INDENT });
  await writeFile(configPath, schemaComment + configYaml);
}
