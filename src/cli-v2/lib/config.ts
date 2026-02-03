import path from "path";
import os from "os";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";
import { readFile, writeFile, fileExists, ensureDir } from "../utils/fs";
import { verbose } from "../utils/logger";

const PROJECT_CONFIG_DIR = ".claude";

export const DEFAULT_SOURCE = "github:claude-collective/skills";
export const SOURCE_ENV_VAR = "CC_SOURCE";
/** Environment variable to override global config directory (used for testing) */
export const CONFIG_HOME_ENV_VAR = "CC_CONFIG_HOME";
export const GLOBAL_CONFIG_FILE = "config.yaml";
export const PROJECT_CONFIG_FILE = "config.yaml";

/**
 * Get global config directory path.
 * Can be overridden via CC_CONFIG_HOME environment variable for testing isolation.
 * This is a function (not constant) to allow tests to set the env var after module load.
 */
export function getGlobalConfigDir(): string {
  return (
    process.env[CONFIG_HOME_ENV_VAR] ||
    path.join(os.homedir(), ".claude-collective")
  );
}

/**
 * @deprecated Use getGlobalConfigDir() instead. This constant is kept for backwards compatibility
 * but won't respect CC_CONFIG_HOME set after module load.
 */
export const GLOBAL_CONFIG_DIR = path.join(os.homedir(), ".claude-collective");

export interface GlobalConfig {
  source?: string;
  author?: string;
  marketplace?: string;
  agents_source?: string;
}

export interface ProjectConfig {
  source?: string;
  author?: string;
  marketplace?: string;
  agents_source?: string;
}

export interface ResolvedConfig {
  source: string;
  sourceOrigin: "flag" | "env" | "project" | "global" | "default";
  marketplace?: string;
}

function isValidGlobalConfig(obj: unknown): obj is GlobalConfig {
  if (typeof obj !== "object" || obj === null) return false;
  const config = obj as Record<string, unknown>;
  if (config.source !== undefined && typeof config.source !== "string")
    return false;
  if (config.author !== undefined && typeof config.author !== "string")
    return false;
  if (
    config.marketplace !== undefined &&
    typeof config.marketplace !== "string"
  )
    return false;
  if (
    config.agents_source !== undefined &&
    typeof config.agents_source !== "string"
  )
    return false;
  return true;
}

function isValidProjectConfig(obj: unknown): obj is ProjectConfig {
  if (typeof obj !== "object" || obj === null) return false;
  const config = obj as Record<string, unknown>;
  if (config.source !== undefined && typeof config.source !== "string")
    return false;
  if (config.author !== undefined && typeof config.author !== "string")
    return false;
  if (
    config.marketplace !== undefined &&
    typeof config.marketplace !== "string"
  )
    return false;
  if (
    config.agents_source !== undefined &&
    typeof config.agents_source !== "string"
  )
    return false;
  return true;
}

export function getGlobalConfigPath(): string {
  return path.join(getGlobalConfigDir(), GLOBAL_CONFIG_FILE);
}

export function getProjectConfigPath(projectDir: string): string {
  return path.join(projectDir, PROJECT_CONFIG_DIR, PROJECT_CONFIG_FILE);
}

/**
 * @deprecated Global config is deprecated. Use project-level config at .claude/config.yaml instead.
 * This function is kept for backwards compatibility during migration.
 */
export async function loadGlobalConfig(): Promise<GlobalConfig | null> {
  const configPath = getGlobalConfigPath();

  if (!(await fileExists(configPath))) {
    verbose(`Global config not found at ${configPath}`);
    return null;
  }

  try {
    const content = await readFile(configPath);
    const parsed = parseYaml(content);
    if (!isValidGlobalConfig(parsed)) {
      verbose(`Invalid global config structure at ${configPath}`);
      return null;
    }
    verbose(`Loaded global config from ${configPath}`);
    return parsed;
  } catch (error) {
    verbose(`Failed to parse global config: ${error}`);
    return null;
  }
}

export async function loadProjectConfig(
  projectDir: string,
): Promise<ProjectConfig | null> {
  const configPath = getProjectConfigPath(projectDir);

  if (!(await fileExists(configPath))) {
    verbose(`Project config not found at ${configPath}`);
    return null;
  }

  try {
    const content = await readFile(configPath);
    const parsed = parseYaml(content);
    if (!isValidProjectConfig(parsed)) {
      verbose(`Invalid project config structure at ${configPath}`);
      return null;
    }
    verbose(`Loaded project config from ${configPath}`);
    return parsed;
  } catch (error) {
    verbose(`Failed to parse project config: ${error}`);
    return null;
  }
}

/**
 * @deprecated Global config is deprecated. Use project-level config at .claude/config.yaml instead.
 * This function is kept for backwards compatibility during migration.
 */
export async function saveGlobalConfig(config: GlobalConfig): Promise<void> {
  const configPath = getGlobalConfigPath();
  await ensureDir(getGlobalConfigDir());
  const content = stringifyYaml(config, { lineWidth: 0 });
  await writeFile(configPath, content);
  verbose(`Saved global config to ${configPath}`);
}

export async function saveProjectConfig(
  projectDir: string,
  config: ProjectConfig,
): Promise<void> {
  const configPath = getProjectConfigPath(projectDir);
  await ensureDir(path.join(projectDir, PROJECT_CONFIG_DIR));
  const content = stringifyYaml(config, { lineWidth: 0 });
  await writeFile(configPath, content);
  verbose(`Saved project config to ${configPath}`);
}

/** Resolve source with precedence: flag > env > project > default */
export async function resolveSource(
  flagValue?: string,
  projectDir?: string,
): Promise<ResolvedConfig> {
  // Load project config for marketplace (marketplace is resolved separately from source)
  const projectConfig = projectDir ? await loadProjectConfig(projectDir) : null;

  // Resolve marketplace: project config only (no flag/env support for marketplace)
  const marketplace = projectConfig?.marketplace;

  if (flagValue !== undefined) {
    if (flagValue === "" || flagValue.trim() === "") {
      throw new Error("--source flag cannot be empty");
    }
    verbose(`Source from --source flag: ${flagValue}`);
    return { source: flagValue, sourceOrigin: "flag", marketplace };
  }

  const envValue = process.env[SOURCE_ENV_VAR];
  if (envValue) {
    verbose(`Source from ${SOURCE_ENV_VAR} env var: ${envValue}`);
    return { source: envValue, sourceOrigin: "env", marketplace };
  }

  if (projectConfig?.source) {
    verbose(`Source from project config: ${projectConfig.source}`);
    return {
      source: projectConfig.source,
      sourceOrigin: "project",
      marketplace,
    };
  }

  verbose(`Using default source: ${DEFAULT_SOURCE}`);
  return { source: DEFAULT_SOURCE, sourceOrigin: "default", marketplace };
}

export type AgentsSourceOrigin = "flag" | "project" | "global" | "default";

export interface ResolvedAgentsSource {
  agentsSource?: string;
  agentsSourceOrigin: AgentsSourceOrigin;
}

/** Resolve agents_source with precedence: flag > project > default (undefined) */
export async function resolveAgentsSource(
  flagValue?: string,
  projectDir?: string,
): Promise<ResolvedAgentsSource> {
  if (flagValue !== undefined) {
    if (flagValue === "" || flagValue.trim() === "") {
      throw new Error("--agent-source flag cannot be empty");
    }
    verbose(`Agents source from --agent-source flag: ${flagValue}`);
    return { agentsSource: flagValue, agentsSourceOrigin: "flag" };
  }

  const projectConfig = projectDir ? await loadProjectConfig(projectDir) : null;
  if (projectConfig?.agents_source) {
    verbose(
      `Agents source from project config: ${projectConfig.agents_source}`,
    );
    return {
      agentsSource: projectConfig.agents_source,
      agentsSourceOrigin: "project",
    };
  }

  verbose("Using default agents source (local CLI)");
  return { agentsSource: undefined, agentsSourceOrigin: "default" };
}

export function formatAgentsSourceOrigin(origin: AgentsSourceOrigin): string {
  switch (origin) {
    case "flag":
      return "--agent-source flag";
    case "project":
      return "project config (.claude/config.yaml)";
    case "global":
      return "global config (~/.claude-collective/config.yaml)";
    case "default":
      return "default (local CLI)";
  }
}

/** Resolve author from project config */
export async function resolveAuthor(
  projectDir?: string,
): Promise<string | undefined> {
  const projectConfig = projectDir ? await loadProjectConfig(projectDir) : null;
  return projectConfig?.author;
}

export function formatSourceOrigin(
  origin: ResolvedConfig["sourceOrigin"],
): string {
  switch (origin) {
    case "flag":
      return "--source flag";
    case "env":
      return `${SOURCE_ENV_VAR} environment variable`;
    case "project":
      return "project config (.claude/config.yaml)";
    case "global":
      return "global config (~/.claude-collective/config.yaml)";
    case "default":
      return "default";
  }
}

export function isLocalSource(source: string): boolean {
  if (source.startsWith("/") || source.startsWith(".")) {
    return true;
  }

  const remoteProtocols = [
    "github:",
    "gh:",
    "gitlab:",
    "bitbucket:",
    "sourcehut:",
    "https://",
    "http://",
  ];

  const hasRemoteProtocol = remoteProtocols.some((prefix) =>
    source.startsWith(prefix),
  );

  if (!hasRemoteProtocol) {
    if (source.includes("..") || source.includes("~")) {
      throw new Error(
        `Invalid source path: ${source}. Path traversal patterns are not allowed.`,
      );
    }
  }

  return !hasRemoteProtocol;
}
