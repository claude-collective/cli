import { Command } from "commander";
import * as p from "@clack/prompts";
import pc from "picocolors";
import path from "path";
import { setVerbose } from "../utils/logger";
import { DIRS, PROJECT_ROOT } from "../consts";
import {
  compileStackPlugin,
  printStackCompilationSummary,
} from "../lib/stack-plugin-compiler";
import { listDirectories } from "../utils/fs";
import { getAgentDefinitions } from "../lib/agent-fetcher";
import { EXIT_CODES } from "../lib/exit-codes";

const DEFAULT_OUTPUT_DIR = "dist/stacks";

export const compileStackCommand = new Command("compile-stack")
  .description("Compile a stack into a standalone plugin")
  .option(
    "-s, --stack <id>",
    "Stack ID to compile (directory name in src/stacks/)",
  )
  .option("-o, --output-dir <dir>", "Output directory", DEFAULT_OUTPUT_DIR)
  .option("--agent-source <url>", "Agent partials source (default: local CLI)")
  .option("--refresh", "Force refresh remote agent source", false)
  .option("-v, --verbose", "Enable verbose logging", false)
  .configureOutput({
    writeErr: (str) => console.error(pc.red(str)),
  })
  .showHelpAfterError(true)
  .action(async (options) => {
    const s = p.spinner();
    setVerbose(options.verbose);

    const projectRoot = process.cwd();
    const outputDir = path.resolve(projectRoot, options.outputDir);
    const stacksDir = path.join(projectRoot, DIRS.stacks);

    let stackId = options.stack;
    if (!stackId) {
      const availableStacks = await listDirectories(stacksDir);
      if (availableStacks.length === 0) {
        p.log.error(`No stacks found in ${stacksDir}`);
        process.exit(EXIT_CODES.ERROR);
      }

      const selected = await p.select({
        message: "Select a stack to compile:",
        options: availableStacks.map((name) => ({
          value: name,
          label: name,
        })),
      });

      if (p.isCancel(selected)) {
        p.log.warn("Cancelled");
        process.exit(EXIT_CODES.CANCELLED);
      }

      stackId = selected as string;
    }

    console.log(`\nCompiling stack plugin: ${pc.cyan(stackId)}`);
    console.log(`  Output directory: ${pc.cyan(outputDir)}\n`);

    let agentSourcePath: string;
    try {
      s.start(
        options.agentSource
          ? "Fetching agent partials..."
          : "Loading agent partials...",
      );
      const agentDefs = await getAgentDefinitions(options.agentSource, {
        forceRefresh: options.refresh,
      });
      agentSourcePath = agentDefs.sourcePath;
      s.stop(
        options.agentSource
          ? `Agent partials fetched from: ${options.agentSource}`
          : `Agent partials loaded from: ${PROJECT_ROOT}`,
      );
    } catch (error) {
      s.stop("Failed to load agent partials");
      p.log.error(String(error));
      process.exit(EXIT_CODES.ERROR);
    }

    try {
      s.start(`Compiling stack "${stackId}"...`);

      const result = await compileStackPlugin({
        stackId,
        outputDir,
        projectRoot,
        agentSourcePath,
      });

      s.stop(`Compiled stack plugin: ${result.stackName}`);

      printStackCompilationSummary(result);

      p.outro(pc.green("Stack plugin compilation complete!"));
    } catch (error) {
      s.stop("Compilation failed");
      p.log.error(String(error));
      process.exit(EXIT_CODES.ERROR);
    }
  });
