import path from "path";
import { directoryExists } from "../utils/fs";
import { verbose } from "../utils/logger";
import { PROJECT_ROOT, DIRS } from "../consts";
import { fetchFromSource, type FetchOptions } from "./source-fetcher";
import type { AgentSourcePaths } from "../../types";

/**
 * Get agent partial definitions.
 *
 * By default, loads from the CLI repository (bundled locally).
 * If a remote source is provided, fetches from that source instead.
 *
 * Architecture:
 * - Default: Agent partials bundled locally with CLI (not plugins)
 * - Override: Can fetch from remote source with --agent-source flag
 *
 * @param remoteSource - Optional remote source URL to fetch from instead of local
 * @param options - Fetch options (only used for remote sources)
 * @returns Paths to agent partial directories
 */
export async function getAgentDefinitions(
  remoteSource?: string,
  options: FetchOptions = {},
): Promise<AgentSourcePaths> {
  // If remote source provided, fetch from there
  if (remoteSource) {
    return fetchAgentDefinitionsFromRemote(remoteSource, options);
  }

  // Default: load from local CLI repo
  return getLocalAgentDefinitions();
}

/**
 * Get agent partial definitions from the local CLI repository.
 *
 * Agent partials are templates bundled with the CLI. They are compiled
 * with user-selected skills to produce the final agent configurations.
 *
 * @returns Paths to agent partial directories within the CLI repo
 */
export async function getLocalAgentDefinitions(): Promise<AgentSourcePaths> {
  const agentsDir = path.join(PROJECT_ROOT, DIRS.agents);
  const templatesDir = path.join(PROJECT_ROOT, DIRS.templates);

  // Validate directories exist
  if (!(await directoryExists(agentsDir))) {
    throw new Error(
      `Agent partials not found at: ${agentsDir}. ` +
        `Ensure the CLI is properly installed.`,
    );
  }

  if (!(await directoryExists(templatesDir))) {
    verbose(`Templates directory not found: ${templatesDir}`);
  }

  verbose(`Agent partials loaded from CLI: ${agentsDir}`);

  return {
    agentsDir,
    templatesDir,
    sourcePath: PROJECT_ROOT,
  };
}

/**
 * Fetch agent partial definitions from a remote source.
 *
 * Used when --agent-source flag is provided to override local partials.
 *
 * @param source - Remote source URL (e.g., "github:org/repo")
 * @param options - Fetch options
 * @returns Paths to agent partial directories
 */
export async function fetchAgentDefinitionsFromRemote(
  source: string,
  options: FetchOptions = {},
): Promise<AgentSourcePaths> {
  verbose(`Fetching agent partials from remote: ${source}`);

  // Fetch the source repository (uses cache if available)
  const result = await fetchFromSource(source, {
    forceRefresh: options.forceRefresh,
    subdir: "", // Need root to access src/agents
  });

  // Build paths to agent components
  const agentsDir = path.join(result.path, "src", "agents");
  const templatesDir = path.join(agentsDir, "_templates");

  // Validate directories exist
  if (!(await directoryExists(agentsDir))) {
    throw new Error(`Agent partials not found at: ${agentsDir}`);
  }

  if (!(await directoryExists(templatesDir))) {
    verbose(`Templates directory not found: ${templatesDir}`);
  }

  verbose(`Agent partials fetched from: ${result.path}`);

  return {
    agentsDir,
    templatesDir,
    sourcePath: result.path,
  };
}

/**
 * @deprecated Use getAgentDefinitions() instead.
 * Kept for backwards compatibility.
 */
export async function fetchAgentDefinitions(
  source: string,
  options: FetchOptions = {},
): Promise<AgentSourcePaths> {
  // If source matches CLI repo, use local
  if (source === PROJECT_ROOT || source.includes("claude-collective/cli")) {
    return getLocalAgentDefinitions();
  }
  // Otherwise treat as remote source override
  return getAgentDefinitions(source, options);
}
