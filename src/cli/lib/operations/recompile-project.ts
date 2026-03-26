import os from "os";
import { detectBothInstallations } from "./detect-both-installations.js";
import { loadAgentDefs } from "./load-agent-defs.js";
import { compileAgents } from "./compile-agents.js";
import { setVerbose } from "../../utils/logger.js";
import { ERROR_MESSAGES } from "../../utils/messages.js";
import type { AgentName } from "../../types/index.js";

export type RecompileProjectOptions = {
  projectDir: string;
  sourceFlag?: string;
  agentSource?: string;
  verbose?: boolean;
};

export type RecompileProjectResult = {
  globalCompiled: AgentName[];
  projectCompiled: AgentName[];
  totalCompiled: number;
  warnings: string[];
};

/**
 * Recompiles all agents for a project (global + project scopes).
 *
 * Detects global and project installations, loads agent definitions,
 * and runs compilation passes for each scope. Delegates skill discovery
 * to compileAgents which auto-discovers via recompileAgents.
 *
 * NOTE: This operation is created for programmatic use. The compile command
 * keeps its own runCompilePass with user-facing log messages (see G8).
 */
export async function recompileProject(
  options: RecompileProjectOptions,
): Promise<RecompileProjectResult> {
  const { projectDir } = options;

  if (options.verbose) {
    setVerbose(true);
  }

  const { global: globalInstallation, project: projectInstallation, hasBoth } =
    await detectBothInstallations(projectDir);

  if (!globalInstallation && !projectInstallation) {
    throw new Error(ERROR_MESSAGES.NO_INSTALLATION);
  }

  const defs = await loadAgentDefs(options.agentSource, { projectDir });
  const warnings: string[] = [];
  let globalCompiled: AgentName[] = [];
  let projectCompiled: AgentName[] = [];

  if (globalInstallation) {
    const result = await compileAgents({
      projectDir: os.homedir(),
      sourcePath: defs.sourcePath,
      outputDir: globalInstallation.agentsDir,
      scopeFilter: hasBoth ? "global" : undefined,
    });
    globalCompiled = result.compiled;
    warnings.push(...result.warnings);
  }

  if (projectInstallation) {
    const result = await compileAgents({
      projectDir,
      sourcePath: defs.sourcePath,
      outputDir: projectInstallation.agentsDir,
      scopeFilter: hasBoth ? "project" : undefined,
    });
    projectCompiled = result.compiled;
    warnings.push(...result.warnings);
  }

  return {
    globalCompiled,
    projectCompiled,
    totalCompiled: globalCompiled.length + projectCompiled.length,
    warnings,
  };
}
