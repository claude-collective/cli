import os from "os";
import path from "path";
import { compileStackPlugin } from "./stack-plugin-compiler";
import { claudePluginInstall, isClaudeCLIAvailable } from "../utils/exec";
import { remove, ensureDir } from "../utils/fs";
import type { CompiledStackPlugin } from "./stack-plugin-compiler";

export interface StackInstallOptions {
  stackId: string;
  projectDir: string;
  sourcePath: string;
  agentSourcePath: string;
}

export interface StackInstallResult {
  pluginName: string;
  stackName: string;
  agents: string[];
  skills: string[];
  pluginPath: string;
}

/**
 * Compile a stack to a temporary directory
 */
export async function compileStackToTemp(options: {
  stackId: string;
  projectRoot: string;
  agentSourcePath?: string;
}): Promise<{ result: CompiledStackPlugin; cleanup: () => Promise<void> }> {
  const tempDir = path.join(os.tmpdir(), `cc-stack-${Date.now()}`);
  await ensureDir(tempDir);

  const result = await compileStackPlugin({
    stackId: options.stackId,
    outputDir: tempDir,
    projectRoot: options.projectRoot,
    agentSourcePath: options.agentSourcePath,
  });

  return {
    result,
    cleanup: async () => {
      await remove(tempDir);
    },
  };
}

/**
 * Install a stack as a single native plugin using `claude plugin install`
 *
 * Flow:
 * 1. Compile stack to temp directory
 * 2. Run `claude plugin install ./temp/stack-id --scope project`
 * 3. Clean up temp directory
 */
export async function installStackAsPlugin(
  options: StackInstallOptions,
): Promise<StackInstallResult> {
  const { stackId, projectDir, sourcePath, agentSourcePath } = options;

  // Check if claude CLI is available
  const claudeAvailable = await isClaudeCLIAvailable();
  if (!claudeAvailable) {
    throw new Error(
      "Claude CLI not found. Please install Claude Code first: https://claude.ai/code",
    );
  }

  // Compile stack to temp directory
  const { result, cleanup } = await compileStackToTemp({
    stackId,
    projectRoot: sourcePath,
    agentSourcePath,
  });

  try {
    // Install using native claude plugin install
    await claudePluginInstall(result.pluginPath, "project", projectDir);

    return {
      pluginName: `stack-${stackId}`,
      stackName: result.stackName,
      agents: result.agents,
      skills: result.skillPlugins,
      pluginPath: result.pluginPath,
    };
  } finally {
    // Clean up temp directory
    await cleanup();
  }
}
