import path from "path";
import { stringify as stringifyYaml } from "yaml";
import { writeFile, fileExists, ensureDir } from "../../utils/fs";
import { verbose, warn } from "../../utils/logger";
import { safeLoadYamlFile } from "../../utils/yaml";
import {
  CLAUDE_DIR,
  CLAUDE_SRC_DIR,
  DEFAULT_BRANDING,
  GITHUB_SOURCE,
  SCHEMA_PATHS,
  STANDARD_FILES,
  YAML_FORMATTING,
  yamlSchemaComment,
} from "../../consts";
import { projectSourceConfigSchema } from "../schemas";
import type { BoundSkill } from "../../types";

export const DEFAULT_SOURCE = `${GITHUB_SOURCE.GITHUB_PREFIX}agents-inc/skills`;
export const SOURCE_ENV_VAR = "CC_SOURCE";
export const PROJECT_CONFIG_FILE = STANDARD_FILES.CONFIG_YAML;

export type SourceEntry = {
  name: string;
  url: string;
  description?: string;
  ref?: string;
};

/** Branding overrides for white-labeling the CLI */
export type BrandingConfig = {
  /** Custom CLI name (e.g., "Acme Dev Tools") */
  name?: string;
  /** Custom tagline shown in wizard header */
  tagline?: string;
};

export type ProjectSourceConfig = {
  source?: string;
  author?: string;
  marketplace?: string;
  agentsSource?: string;
  sources?: SourceEntry[];
  boundSkills?: BoundSkill[];
  /** Branding overrides for white-labeling the CLI */
  branding?: BrandingConfig;
  skillsDir?: string; // default: src/skills (SKILLS_DIR_PATH)
  agentsDir?: string; // default: src/agents (DIRS.agents)
  stacksFile?: string; // default: config/stacks.yaml (STACKS_FILE)
  matrixFile?: string; // default: config/skills-matrix.yaml (SKILLS_MATRIX_PATH)
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
  const srcConfigPath = getProjectConfigPath(projectDir);
  const legacyConfigPath = path.join(projectDir, CLAUDE_DIR, STANDARD_FILES.CONFIG_YAML);

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

  const data = await safeLoadYamlFile(configPath, projectSourceConfigSchema);
  if (!data) return null;

  verbose(`Loaded project config from ${configPath}`);
  return data as ProjectSourceConfig;
}

export async function saveProjectConfig(
  projectDir: string,
  config: ProjectSourceConfig,
): Promise<void> {
  const configPath = getProjectConfigPath(projectDir);
  await ensureDir(path.join(projectDir, CLAUDE_SRC_DIR));
  const schemaComment = `${yamlSchemaComment(SCHEMA_PATHS.projectSourceConfig)}\n`;
  const content = stringifyYaml(config, { lineWidth: YAML_FORMATTING.LINE_WIDTH_NONE });
  await writeFile(configPath, `${schemaComment}${content}`);
  verbose(`Saved project config to ${configPath}`);
}

// Precedence: flag > env > project > default
export async function resolveSource(
  flagValue?: string,
  projectDir?: string,
): Promise<ResolvedConfig> {
  const projectConfig = projectDir ? await loadProjectSourceConfig(projectDir) : null;
  const marketplace = projectConfig?.marketplace;

  if (flagValue !== undefined) {
    if (flagValue === "" || flagValue.trim() === "") {
      throw new Error(
        "--source flag cannot be empty. Provide a valid source: a local directory path or a git repository URL (e.g., './my-skills' or 'https://github.com/user/repo')",
      );
    }
    validateSourceFormat(flagValue.trim(), "--source");
    verbose(`Source from --source flag: ${flagValue}`);
    return { source: flagValue, sourceOrigin: "flag", marketplace };
  }

  const envValue = process.env[SOURCE_ENV_VAR];
  if (envValue) {
    const trimmed = envValue.trim();
    if (trimmed === "") {
      warn(`${SOURCE_ENV_VAR} is set but empty — ignoring and falling back to next source.`);
    } else {
      try {
        validateSourceFormat(trimmed, SOURCE_ENV_VAR);
        verbose(`Source from ${SOURCE_ENV_VAR} env var: ${trimmed}`);
        return { source: trimmed, sourceOrigin: "env", marketplace };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        warn(
          `${SOURCE_ENV_VAR} has an invalid value — ignoring and falling back to next source.\n${message}`,
        );
      }
    }
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

// Precedence: flag > project > default (undefined)
export async function resolveAgentsSource(
  flagValue?: string,
  projectDir?: string,
): Promise<ResolvedAgentsSource> {
  if (flagValue !== undefined) {
    if (flagValue === "" || flagValue.trim() === "") {
      throw new Error(
        "--agent-source flag cannot be empty. Provide a valid source: a local directory path or a git repository URL (e.g., './my-agents' or 'https://github.com/user/repo')",
      );
    }
    validateSourceFormat(flagValue.trim(), "--agent-source");
    verbose(`Agents source from --agent-source flag: ${flagValue}`);
    return { agentsSource: flagValue, agentsSourceOrigin: "flag" };
  }

  const projectConfig = projectDir ? await loadProjectSourceConfig(projectDir) : null;
  if (projectConfig?.agentsSource) {
    verbose(`Agents source from project config: ${projectConfig.agentsSource}`);
    return {
      agentsSource: projectConfig.agentsSource,
      agentsSourceOrigin: "project",
    };
  }

  verbose("Using default agents source (local CLI)");
  return { agentsSource: undefined, agentsSourceOrigin: "default" };
}

const PROJECT_ORIGIN_LABEL = "project config (.claude-src/config.yaml)";

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
      default:
        break;
    }
  }

  // type === "agents"
  switch (origin) {
    case "flag":
      return "--agent-source flag";
    case "default":
      return "default (local CLI)";
    default:
      break;
  }

  return origin;
}

export async function resolveAuthor(projectDir?: string): Promise<string | undefined> {
  const projectConfig = projectDir ? await loadProjectSourceConfig(projectDir) : null;
  return projectConfig?.author;
}

/** Resolved branding with defaults applied for any missing fields */
export type ResolvedBranding = {
  name: string;
  tagline: string;
};

/** Resolves branding from project config, falling back to DEFAULT_BRANDING for missing fields. */
export async function resolveBranding(projectDir?: string): Promise<ResolvedBranding> {
  const projectConfig = projectDir ? await loadProjectSourceConfig(projectDir) : null;
  return {
    name: projectConfig?.branding?.name ?? DEFAULT_BRANDING.NAME,
    tagline: projectConfig?.branding?.tagline ?? DEFAULT_BRANDING.TAGLINE,
  };
}

export async function resolveAllSources(
  projectDir?: string,
): Promise<{ primary: SourceEntry; extras: SourceEntry[] }> {
  const projectConfig = projectDir ? await loadProjectSourceConfig(projectDir) : null;

  const resolvedConfig = await resolveSource(undefined, projectDir);
  const primary: SourceEntry = {
    name: "marketplace",
    url: resolvedConfig.source,
    description: "Primary skills marketplace",
  };

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

const REMOTE_PROTOCOLS = [
  GITHUB_SOURCE.GITHUB_PREFIX, // "github:"
  GITHUB_SOURCE.GH_PREFIX, // "gh:"
  "gitlab:",
  "bitbucket:",
  "sourcehut:",
  "https://",
  "http://",
] as const;

// Minimum length after protocol prefix for a valid remote source (e.g., "org/repo" = 8 chars min)
const MIN_REMOTE_PATH_LENGTH = 3;
const MAX_SOURCE_LENGTH = 512;

// Null bytes must never appear in source strings — they can bypass C-level string termination in downstream tools
const NULL_BYTE_PATTERN = /\0/;

// Path traversal sequences in git refs/branches/tags (e.g., "?branch=../../etc/passwd")
const PATH_TRAVERSAL_PATTERN = /\.\./;

// UNC path prefixes (Windows network paths): \\server\share or //server/share
// These can trigger SMB authentication to attacker-controlled servers
const UNC_PATH_PATTERN = /^(?:\/\/|\\\\)/;

// Private/reserved IPv4 ranges that should not appear in source URLs (SSRF prevention)
// Matches: 127.x.x.x, 10.x.x.x, 172.16-31.x.x, 192.168.x.x, 0.0.0.0, 169.254.x.x
const PRIVATE_IPV4_PATTERN =
  /^(?:127\.\d+\.\d+\.\d+|10\.\d+\.\d+\.\d+|172\.(?:1[6-9]|2\d|3[01])\.\d+\.\d+|192\.168\.\d+\.\d+|0\.0\.0\.0|169\.254\.\d+\.\d+)$/;

// IPv6 loopback and private addresses in URL hostname brackets
const PRIVATE_IPV6_PATTERN =
  /^\[(?:::1|::ffff:(?:127\.\d+\.\d+\.\d+|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+)|fd[0-9a-f]{2}:.*|fe80:.*)\]$/i;

/**
 * Validates a source string format before it reaches giget or filesystem operations.
 * Catches obviously invalid formats early with clear error messages.
 *
 * @param source - The trimmed, non-empty source value to validate
 * @param flagName - The flag name for error messages ("--source" or "--agent-source")
 */
export function validateSourceFormat(source: string, flagName: string): void {
  // Null bytes can bypass C-level string termination in downstream tools (giget, git)
  if (NULL_BYTE_PATTERN.test(source)) {
    throw new Error(
      `${flagName} contains invalid characters.\n\n` +
        `Source values must not contain null bytes.\n` +
        `Examples:\n` +
        `  ${flagName} ./my-skills\n` +
        `  ${flagName} github:user/repo`,
    );
  }

  if (source.length > MAX_SOURCE_LENGTH) {
    throw new Error(
      `${flagName} value is too long (${source.length} characters, max ${MAX_SOURCE_LENGTH}).\n\n` +
        `Provide a shorter source path or URL.\n` +
        `Examples:\n` +
        `  ${flagName} ./my-skills\n` +
        `  ${flagName} github:user/repo`,
    );
  }

  const matchedProtocol = REMOTE_PROTOCOLS.find((prefix) => source.startsWith(prefix));

  if (matchedProtocol) {
    validateRemoteSource(source, matchedProtocol, flagName);
  } else {
    validateLocalPath(source, flagName);
  }
}

function validateRemoteSource(source: string, protocol: string, flagName: string): void {
  const pathAfterProtocol = source.slice(protocol.length).trim();

  if (pathAfterProtocol.length < MIN_REMOTE_PATH_LENGTH) {
    throw new Error(
      `${flagName} has an incomplete URL: "${source}"\n\n` +
        `A repository path is required after the protocol prefix.\n` +
        `Examples:\n` +
        `  ${flagName} github:user/repo\n` +
        `  ${flagName} https://github.com/user/repo`,
    );
  }

  // Block path traversal in any remote source (refs, branches, query params)
  if (PATH_TRAVERSAL_PATTERN.test(pathAfterProtocol)) {
    throw new Error(
      `${flagName} contains path traversal in URL: "${source}"\n\n` +
        `Remote source URLs must not contain '..' sequences.\n` +
        `Examples:\n` +
        `  ${flagName} github:user/repo\n` +
        `  ${flagName} https://github.com/user/repo`,
    );
  }

  // For https:// and http:// URLs, validate basic URL structure
  if (protocol === "https://" || protocol === "http://") {
    validateHttpUrl(source, flagName);
  }

  // For git shorthand protocols (github:, gh:, gitlab:, etc.), validate org/repo pattern
  if (protocol !== "https://" && protocol !== "http://") {
    validateGitShorthand(source, pathAfterProtocol, flagName);
  }
}

function validateHttpUrl(source: string, flagName: string): void {
  // Basic URL structure check: must have a hostname with at least one dot or localhost
  const afterProtocol = source.replace(/^https?:\/\//, "");
  // Strip port number for hostname validation (e.g., "localhost:8080" -> "localhost")
  const hostnameWithPort = afterProtocol.split("/")[0] ?? "";
  const hostname = hostnameWithPort.split(":")[0] ?? "";

  // Allow: dotted hostnames (github.com), localhost, and bracketed IPv6 ([::1])
  const isBracketedIPv6 = hostnameWithPort.startsWith("[") && hostnameWithPort.includes("]");
  if (!hostname || (!hostname.includes(".") && hostname !== "localhost" && !isBracketedIPv6)) {
    throw new Error(
      `${flagName} has an invalid URL: "${source}"\n\n` +
        `The URL must include a valid hostname.\n` +
        `Examples:\n` +
        `  ${flagName} https://github.com/user/repo\n` +
        `  ${flagName} https://gitlab.company.com/team/skills`,
    );
  }

  // Block private/reserved IP addresses (SSRF prevention via giget)
  if (PRIVATE_IPV4_PATTERN.test(hostname) || PRIVATE_IPV6_PATTERN.test(hostnameWithPort)) {
    throw new Error(
      `${flagName} points to a private or reserved IP address: "${source}"\n\n` +
        `Source URLs must not target private network addresses.\n` +
        `Use a public hostname instead.\n` +
        `Examples:\n` +
        `  ${flagName} https://github.com/user/repo\n` +
        `  ${flagName} https://gitlab.company.com/team/skills`,
    );
  }
}

function validateGitShorthand(source: string, repoPath: string, flagName: string): void {
  // Git shorthand format: protocol:owner/repo (must have at least owner/repo)
  if (!repoPath.includes("/")) {
    throw new Error(
      `${flagName} has an invalid repository reference: "${source}"\n\n` +
        `Git shorthand sources require an owner/repo format.\n` +
        `Examples:\n` +
        `  ${flagName} github:user/repo\n` +
        `  ${flagName} gh:organization/skills`,
    );
  }
}

function validateLocalPath(source: string, flagName: string): void {
  // Check for control characters (except common whitespace)
  // eslint-disable-next-line no-control-regex
  const CONTROL_CHAR_PATTERN = /[\x00-\x08\x0E-\x1F\x7F]/u;
  if (CONTROL_CHAR_PATTERN.test(source)) {
    throw new Error(
      `${flagName} contains invalid characters: "${source}"\n\n` +
        `Source paths must not contain control characters.\n` +
        `Examples:\n` +
        `  ${flagName} ./my-skills\n` +
        `  ${flagName} /home/user/skills`,
    );
  }

  // Block UNC paths (Windows network paths like \\server\share or //server/share)
  // These can trigger SMB authentication to attacker-controlled servers, leaking credentials
  if (UNC_PATH_PATTERN.test(source)) {
    throw new Error(
      `${flagName} contains a UNC network path: "${source}"\n\n` +
        `Network paths (\\\\server\\share or //server/share) are not allowed for security reasons.\n` +
        `Use a local directory path or a remote URL instead.\n` +
        `Examples:\n` +
        `  ${flagName} ./my-skills\n` +
        `  ${flagName} /home/user/skills\n` +
        `  ${flagName} https://github.com/user/repo`,
    );
  }
}

export function isLocalSource(source: string): boolean {
  if (source.startsWith("/") || source.startsWith(".")) {
    return true;
  }

  const hasRemoteProtocol = REMOTE_PROTOCOLS.some((prefix) => source.startsWith(prefix));

  if (!hasRemoteProtocol) {
    if (source.includes("..") || source.includes("~")) {
      throw new Error(
        `Invalid source path: ${source}. Path traversal patterns like '..' and '~' are not allowed for security reasons. Use absolute paths or remote URLs instead (e.g., '/home/user/skills' or 'https://github.com/user/repo').`,
      );
    }
  }

  return !hasRemoteProtocol;
}
