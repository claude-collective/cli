import path from "path";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";
import { readFile, writeFile, fileExists, ensureDir } from "../../utils/fs";
import { verbose } from "../../utils/logger";
import { CLAUDE_DIR, CLAUDE_SRC_DIR } from "../../consts";
import { projectSourceConfigSchema } from "../schemas";

export const DEFAULT_SOURCE = "github:claude-collective/skills";
export const SOURCE_ENV_VAR = "CC_SOURCE";
export const PROJECT_CONFIG_FILE = "config.yaml";

/**
 * Extra source entry for third-party skill repositories.
 * Used in project configs.
 */
export type SourceEntry = {
  /** Short name for the source (e.g., "company", "team") */
  name: string;
  /** GitHub URL or path (e.g., "github:owner/repo") */
  url: string;
  /** Optional description */
  description?: string;
  /** Optional ref to pin to (branch, tag, or commit) */
  ref?: string;
};

export type ProjectSourceConfig = {
  source?: string;
  author?: string;
  marketplace?: string;
  agents_source?: string;
  /** Extra sources for third-party skills */
  sources?: SourceEntry[];
};

export type ResolvedConfig = {
  source: string;
  sourceOrigin: "flag" | "env" | "project" | "default";
  marketplace?: string;
};

export function getProjectConfigPath(projectDir: string): string {
  return path.join(projectDir, CLAUDE_SRC_DIR, PROJECT_CONFIG_FILE);
}

export async function loadProjectSourceConfig(
  projectDir: string,
): Promise<ProjectSourceConfig | null> {
  // Check .claude-src/config.yaml first (new location)
  const srcConfigPath = getProjectConfigPath(projectDir);
  // Fall back to .claude/config.yaml (legacy location)
  const legacyConfigPath = path.join(projectDir, CLAUDE_DIR, "config.yaml");

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
    const result = projectSourceConfigSchema.safeParse(parsed);
    if (!result.success) {
      verbose(`Invalid project config structure at ${configPath}: ${result.error.message}`);
      return null;
    }
    verbose(`Loaded project config from ${configPath}`);
    return result.data as ProjectSourceConfig;
  } catch (error) {
    verbose(`Failed to parse project config: ${error}`);
    return null;
  }
}

export async function saveProjectConfig(
  projectDir: string,
  config: ProjectSourceConfig,
): Promise<void> {
  const configPath = getProjectConfigPath(projectDir);
  await ensureDir(path.join(projectDir, CLAUDE_SRC_DIR));
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
  const projectConfig = projectDir ? await loadProjectSourceConfig(projectDir) : null;

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

export type AgentsSourceOrigin = "flag" | "project" | "default";

export type ResolvedAgentsSource = {
  agentsSource?: string;
  agentsSourceOrigin: AgentsSourceOrigin;
};

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

  const projectConfig = projectDir ? await loadProjectSourceConfig(projectDir) : null;
  if (projectConfig?.agents_source) {
    verbose(`Agents source from project config: ${projectConfig.agents_source}`);
    return {
      agentsSource: projectConfig.agents_source,
      agentsSourceOrigin: "project",
    };
  }

  verbose("Using default agents source (local CLI)");
  return { agentsSource: undefined, agentsSourceOrigin: "default" };
}

/** Shared origin label for project config */
const PROJECT_ORIGIN_LABEL = "project config (.claude-src/config.yaml)";

/**
 * Format a human-readable label for a config origin.
 * Consolidates source and agents-source formatting into one function.
 */
export function formatOrigin(
  type: "source" | "agents",
  origin: ResolvedConfig["sourceOrigin"] | AgentsSourceOrigin,
): string {
  if (origin === "project") return PROJECT_ORIGIN_LABEL;

  if (type === "source") {
    switch (origin) {
      case "flag":
        return "--source flag";
      case "env":
        return `${SOURCE_ENV_VAR} environment variable`;
      case "default":
        return "default";
    }
  }

  // type === "agents"
  switch (origin) {
    case "flag":
      return "--agent-source flag";
    case "default":
      return "default (local CLI)";
  }

  return origin;
}

/** Resolve author from project config */
export async function resolveAuthor(projectDir?: string): Promise<string | undefined> {
  const projectConfig = projectDir ? await loadProjectSourceConfig(projectDir) : null;
  return projectConfig?.author;
}

/**
 * Resolve all configured sources for skill search.
 * Returns primary source plus any extra sources from project config.
 */
export async function resolveAllSources(
  projectDir?: string,
): Promise<{ primary: SourceEntry; extras: SourceEntry[] }> {
  const projectConfig = projectDir ? await loadProjectSourceConfig(projectDir) : null;

  // Get primary source
  const resolvedConfig = await resolveSource(undefined, projectDir);
  const primary: SourceEntry = {
    name: "marketplace",
    url: resolvedConfig.source,
    description: "Primary skills marketplace",
  };

  // Collect extra sources from project config
  const extras: SourceEntry[] = [];
  const seenNames = new Set<string>();

  if (projectConfig?.sources) {
    for (const source of projectConfig.sources) {
      if (!seenNames.has(source.name)) {
        seenNames.add(source.name);
        extras.push(source);
      }
    }
  }

  return { primary, extras };
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

  const hasRemoteProtocol = remoteProtocols.some((prefix) => source.startsWith(prefix));

  if (!hasRemoteProtocol) {
    if (source.includes("..") || source.includes("~")) {
      throw new Error(`Invalid source path: ${source}. Path traversal patterns are not allowed.`);
    }
  }

  return !hasRemoteProtocol;
}
