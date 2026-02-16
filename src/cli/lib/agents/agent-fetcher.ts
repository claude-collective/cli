import path from "path";
import { directoryExists } from "../../utils/fs";
import { verbose } from "../../utils/logger";
import { PROJECT_ROOT, DIRS, CLAUDE_DIR } from "../../consts";
import { fetchFromSource, type FetchOptions } from "../loading";
import { loadProjectSourceConfig } from "../configuration";
import type { AgentSourcePaths } from "../../types";

export type AgentDefinitionOptions = FetchOptions & {
  projectDir?: string;
};

export async function getAgentDefinitions(
  remoteSource?: string,
  options: AgentDefinitionOptions = {},
): Promise<AgentSourcePaths> {
  if (remoteSource) {
    return fetchAgentDefinitionsFromRemote(remoteSource, options);
  }
  return getLocalAgentDefinitions(options);
}

export async function getLocalAgentDefinitions(
  options: AgentDefinitionOptions = {},
): Promise<AgentSourcePaths> {
  const agentsDir = path.join(PROJECT_ROOT, DIRS.agents);
  let templatesDir = path.join(PROJECT_ROOT, DIRS.templates);

  if (!(await directoryExists(agentsDir))) {
    throw new Error(
      `Agent partials not found at '${agentsDir}'. Ensure the CLI is properly installed.`,
    );
  }

  if (options.projectDir) {
    const localTemplatesDir = path.join(options.projectDir, CLAUDE_DIR, "templates");
    if (await directoryExists(localTemplatesDir)) {
      verbose(`Using local templates from: ${localTemplatesDir}`);
      templatesDir = localTemplatesDir;
    }
  }

  if (!(await directoryExists(templatesDir))) {
    verbose(`Templates directory not found: ${templatesDir}`);
  }

  verbose(`Agent partials loaded from CLI: ${agentsDir}`);
  verbose(`Templates directory: ${templatesDir}`);

  return {
    agentsDir,
    templatesDir,
    sourcePath: PROJECT_ROOT,
  };
}

export async function fetchAgentDefinitionsFromRemote(
  source: string,
  options: FetchOptions & { agentsDir?: string } = {},
): Promise<AgentSourcePaths> {
  verbose(`Fetching agent partials from remote: ${source}`);

  const result = await fetchFromSource(source, {
    forceRefresh: options.forceRefresh,
    subdir: "",
  });

  let agentsDirRelPath = options.agentsDir;
  if (!agentsDirRelPath) {
    const sourceProjectConfig = await loadProjectSourceConfig(result.path);
    agentsDirRelPath = sourceProjectConfig?.agents_dir ?? DIRS.agents;
    if (sourceProjectConfig?.agents_dir) {
      verbose(`Using agents_dir from source config: ${sourceProjectConfig.agents_dir}`);
    }
  }

  const agentsDir = path.join(result.path, agentsDirRelPath);
  const templatesDir = path.join(agentsDir, "_templates");

  if (!(await directoryExists(agentsDir))) {
    throw new Error(`Agent partials not found at '${agentsDir}'`);
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
