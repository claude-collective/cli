import React from "react";
import { Flags } from "@oclif/core";
import { render, Box, Text } from "ink";
import { Select } from "@inkjs/ui";
import path from "path";
import { BaseCommand } from "../../base-command";
import { setVerbose } from "../../utils/logger";
import { PROJECT_ROOT } from "../../consts";
import { compileStackPlugin, printStackCompilationSummary } from "../../lib/stack-plugin-compiler";
import { getAgentDefinitions } from "../../lib/agent-fetcher";
import { EXIT_CODES } from "../../lib/exit-codes";
import { loadStacks } from "../../lib/stacks-loader";

const DEFAULT_OUTPUT_DIR = "dist/stacks";

type StackSelectorProps = {
  availableStacks: string[];
  onSelect: (stackId: string) => void;
};

const StackSelector: React.FC<StackSelectorProps> = ({ availableStacks, onSelect }) => {
  return (
    <Box flexDirection="column">
      <Text>Select a stack to compile:</Text>
      <Select
        options={availableStacks.map((name) => ({
          value: name,
          label: name,
        }))}
        onChange={(value) => {
          onSelect(value);
        }}
      />
    </Box>
  );
};

export default class BuildStack extends BaseCommand {
  static summary = "Build a stack into a standalone plugin";

  static description =
    "Build a stack into a standalone plugin (requires skills repo). If no stack is specified, you will be prompted to select one.";

  static examples = [
    "<%= config.bin %> <%= command.id %>",
    "<%= config.bin %> <%= command.id %> --stack frontend-stack",
    "<%= config.bin %> <%= command.id %> --stack frontend-stack --output-dir ./plugins",
    "<%= config.bin %> <%= command.id %> --agent-source /path/to/agents --refresh",
  ];

  static flags = {
    ...BaseCommand.baseFlags,
    stack: Flags.string({
      description: "Stack ID to compile (directory name in src/stacks/)",
    }),
    "output-dir": Flags.string({
      char: "o",
      description: "Output directory",
      default: DEFAULT_OUTPUT_DIR,
    }),
    "agent-source": Flags.string({
      description: "Agent partials source (default: local CLI)",
    }),
    refresh: Flags.boolean({
      description: "Force refresh remote agent source",
      default: false,
    }),
    verbose: Flags.boolean({
      char: "v",
      description: "Enable verbose logging",
      default: false,
    }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(BuildStack);

    setVerbose(flags.verbose);

    const projectRoot = process.cwd();
    const outputDir = path.resolve(projectRoot, flags["output-dir"]);

    let stackId = flags.stack;

    // If no stack specified, prompt for selection
    if (!stackId) {
      const stacks = await loadStacks(projectRoot);
      const availableStacks = stacks.map((s) => s.id).sort();

      if (availableStacks.length === 0) {
        this.error(`No stacks found in config/stacks.yaml`, {
          exit: EXIT_CODES.ERROR,
        });
      }

      // Render interactive selector
      stackId = await new Promise<string>((resolve, reject) => {
        const { waitUntilExit } = render(
          <StackSelector
            availableStacks={availableStacks}
            onSelect={(selected) => {
              resolve(selected);
            }}
          />,
        );

        waitUntilExit().catch(reject);
      }).catch(() => {
        this.log("Cancelled");
        this.exit(EXIT_CODES.CANCELLED);
      });
    }

    this.log("");
    this.log(`Compiling stack plugin: ${stackId}`);
    this.log(`  Output directory: ${outputDir}`);
    this.log("");

    // Load agent partials
    let agentSourcePath: string;
    try {
      this.log(flags["agent-source"] ? "Fetching agent partials..." : "Loading agent partials...");
      const agentDefs = await getAgentDefinitions(flags["agent-source"], {
        forceRefresh: flags.refresh,
      });
      agentSourcePath = agentDefs.sourcePath;
      this.log(
        flags["agent-source"]
          ? `Agent partials fetched from: ${flags["agent-source"]}`
          : `Agent partials loaded from: ${PROJECT_ROOT}`,
      );
    } catch (error) {
      this.log("Failed to load agent partials");
      this.error(error instanceof Error ? error.message : String(error), {
        exit: EXIT_CODES.ERROR,
      });
    }

    // Compile the stack
    try {
      this.log(`Compiling stack "${stackId}"...`);

      const result = await compileStackPlugin({
        stackId,
        outputDir,
        projectRoot,
        agentSourcePath,
      });

      this.log(`Compiled stack plugin: ${result.stackName}`);

      printStackCompilationSummary(result);

      this.log("");
      this.logSuccess("Stack plugin compilation complete!");
    } catch (error) {
      this.log("Compilation failed");
      this.error(error instanceof Error ? error.message : String(error), {
        exit: EXIT_CODES.ERROR,
      });
    }
  }
}
