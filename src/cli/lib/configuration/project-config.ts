import path from "path";
import { fileExists } from "../../utils/fs";
import { verbose, warn } from "../../utils/logger";
import { safeLoadYamlFile } from "../../utils/yaml";
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

  const data = await safeLoadYamlFile(configPath, projectConfigLoaderSchema);
  if (!data) return null;

  const config = data as ProjectConfig;
  if (!config.name) {
    warn(
      `Project config at '${configPath}' is missing required 'name' field — defaulting to directory name`,
    );
    config.name = path.basename(projectDir);
  }
  if (!config.skills) {
    warn(`Project config at '${configPath}' is missing 'skills' array — defaulting to empty`);
    config.skills = [];
  }

  verbose(`Loaded project config from ${configPath}`);
  return {
    config,
    configPath,
  };
}

export function validateProjectConfig(config: unknown): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!config || typeof config !== "object") {
    return { valid: false, errors: ["Config must be an object"], warnings: [] };
  }

  // Boundary cast: config validated as object above, narrow to record for field access
  const c = config as Record<string, unknown>;

  if (!c.name || typeof c.name !== "string") {
    errors.push("name is required and must be a string");
  }

  if (!c.agents || !Array.isArray(c.agents)) {
    errors.push("agents is required and must be an array");
  } else {
    for (const agent of c.agents) {
      if (typeof agent !== "string") {
        errors.push(`agents must contain strings, found: ${typeof agent}`);
      }
    }
  }

  if (c.version !== undefined && c.version !== "1") {
    errors.push('version must be "1" (or omitted for default)');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}
