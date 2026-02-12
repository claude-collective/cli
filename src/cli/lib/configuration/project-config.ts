import path from "path";
import { parse as parseYaml } from "yaml";
import { readFile, fileExists } from "../../utils/fs";
import { verbose, warn } from "../../utils/logger";
import { CLAUDE_DIR, CLAUDE_SRC_DIR } from "../../consts";
import type { ProjectConfig, ValidationResult } from "../../types";
import { projectConfigLoaderSchema } from "../schemas";

const CONFIG_PATH = `${CLAUDE_SRC_DIR}/config.yaml`;
const LEGACY_CONFIG_PATH = `${CLAUDE_DIR}/config.yaml`;

export type LoadedProjectConfig = {
  config: ProjectConfig;
  configPath: string;
};

export async function loadProjectConfig(projectDir: string): Promise<LoadedProjectConfig | null> {
  // Check .claude-src/config.yaml first (new location)
  const srcConfigPath = path.join(projectDir, CONFIG_PATH);
  // Fall back to .claude/config.yaml (legacy location)
  const legacyConfigPath = path.join(projectDir, LEGACY_CONFIG_PATH);

  let configPath = srcConfigPath;
  if (!(await fileExists(srcConfigPath))) {
    if (await fileExists(legacyConfigPath)) {
      configPath = legacyConfigPath;
      verbose(`Using legacy config location: ${legacyConfigPath}`);
    } else {
      verbose(`Project config not found at ${srcConfigPath} or ${legacyConfigPath}`);
      return null;
    }
  }

  try {
    const content = await readFile(configPath);
    const parsed = parseYaml(content);

    if (!parsed || typeof parsed !== "object") {
      warn(`Invalid project config structure at ${configPath}`);
      return null;
    }

    const result = projectConfigLoaderSchema.safeParse(parsed);
    if (!result.success) {
      warn(`Invalid project config at ${configPath}: ${result.error.message}`);
      return null;
    }

    const config = result.data as ProjectConfig;
    if (!config.name) {
      warn(
        `Project config at ${configPath} is missing required 'name' field — defaulting to directory name`,
      );
      config.name = path.basename(projectDir);
    }

    verbose(`Loaded project config from ${configPath}`);
    return {
      config,
      configPath,
    };
  } catch (error) {
    warn(`Failed to parse project config at ${configPath}: ${error}`);
    return null;
  }
}

export function validateProjectConfig(config: unknown): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!config || typeof config !== "object") {
    return { valid: false, errors: ["Config must be an object"], warnings: [] };
  }

  const c = config as Record<string, unknown>;

  // Required: name
  if (!c.name || typeof c.name !== "string") {
    errors.push("name is required and must be a string");
  }

  // Required: agents (for compilation)
  if (!c.agents || !Array.isArray(c.agents)) {
    errors.push("agents is required and must be an array");
  } else {
    for (const agent of c.agents) {
      if (typeof agent !== "string") {
        errors.push(`agents must contain strings, found: ${typeof agent}`);
      }
    }
  }

  // Optional: version
  if (c.version !== undefined && c.version !== "1") {
    errors.push('version must be "1" (or omitted for default)');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}
