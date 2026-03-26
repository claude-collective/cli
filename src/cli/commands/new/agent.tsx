import React, { useState } from "react";

import { Args, Flags } from "@oclif/core";
import { TextInput } from "@inkjs/ui";
import { render, Box, Text, useApp, useInput } from "ink";
import path from "path";

import { BaseCommand } from "../../base-command.js";
import { CLAUDE_DIR, CLI_COLORS, STANDARD_FILES } from "../../consts.js";
import { resolveSource } from "../../lib/configuration/index.js";
import {
  loadConfigTypesDataInBackground,
  regenerateConfigTypes,
} from "../../lib/configuration/config-types-writer.js";
import { EXIT_CODES } from "../../lib/exit-codes.js";
import { buildAgentPrompt, invokeMetaAgent, loadMetaAgent } from "../../lib/operations/index.js";
import { getErrorMessage } from "../../utils/errors.js";
import { isClaudeCLIAvailable } from "../../utils/exec.js";

const SEPARATOR_WIDTH = 60;

type PurposeInputProps = {
  onSubmit: (purpose: string) => void;
  onCancel: () => void;
};

const PurposeInput: React.FC<PurposeInputProps> = ({ onSubmit, onCancel }) => {
  const { exit } = useApp();
  const [error, setError] = useState<string | null>(null);

  useInput((_input, key) => {
    if (key.escape) {
      onCancel();
      exit();
    }
  });

  const handleSubmit = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) {
      setError("Purpose is required");
      return;
    }
    onSubmit(trimmed);
    exit();
  };

  return (
    <Box flexDirection="column">
      <Text bold>Create New Agent</Text>
      <Text>What should this agent do?</Text>
      <Text dimColor>e.g., Manages database migrations with rollback support</Text>
      <Text> </Text>
      <TextInput placeholder="Enter agent purpose..." onSubmit={handleSubmit} />
      {error && (
        <Box marginTop={1}>
          <Text color={CLI_COLORS.ERROR}>{error}</Text>
        </Box>
      )}
    </Box>
  );
};

export default class NewAgent extends BaseCommand {
  static summary = "Create a new custom agent using AI generation";
  static description =
    "Uses the agent-summoner meta-agent to scaffold a new agent with proper structure and documentation.";

  static args = {
    name: Args.string({
      description: "Name of the agent to create",
      required: true,
    }),
  };

  static flags = {
    ...BaseCommand.baseFlags,
    purpose: Flags.string({
      char: "p",
      description: "Purpose/description of the agent",
      required: false,
    }),
    "non-interactive": Flags.boolean({
      char: "n",
      description: "Run in non-interactive mode",
      default: false,
    }),
    refresh: Flags.boolean({
      char: "r",
      description: "Force refresh remote source",
      default: false,
    }),
  };

  async run(): Promise<void> {
    const { args, flags } = await this.parse(NewAgent);
    const projectDir = process.cwd();

    // Kick off background loading for config-types.ts regeneration (non-blocking)
    const configTypesReady = loadConfigTypesDataInBackground(flags.source, projectDir);

    const cliAvailable = await isClaudeCLIAvailable();
    if (!cliAvailable) {
      this.error(
        "Claude CLI not found. Please install it first:\n" +
          "  npm install -g @anthropic-ai/claude-code",
        { exit: EXIT_CODES.ERROR },
      );
    }

    let purpose = flags.purpose;

    if (!purpose) {
      let inputResult: string | null = null;
      let cancelled = false;

      const { waitUntilExit } = render(
        <PurposeInput
          onSubmit={(value) => {
            inputResult = value;
          }}
          onCancel={() => {
            cancelled = true;
          }}
        />,
      );

      await waitUntilExit();

      if (cancelled || !inputResult) {
        this.log("Cancelled");
        this.exit(EXIT_CODES.CANCELLED);
      }

      purpose = inputResult;
    }

    const outputDir = path.join(projectDir, CLAUDE_DIR, "agents", "_custom");

    this.log("");
    this.log(`Agent name: ${args.name}`);
    this.log(`Purpose: ${purpose}`);
    this.log(`Output: ${outputDir}`);
    this.log("");

    this.log("Fetching agent-summoner from source...");

    try {
      const sourceConfig = await resolveSource(flags.source, projectDir);
      const agentDef = await loadMetaAgent({
        projectDir,
        source: sourceConfig.source,
        forceRefresh: flags.refresh,
      });
      this.log("Meta-agent loaded");
      this.log("");

      const agentPrompt = buildAgentPrompt(args.name, purpose, outputDir);

      this.log("Invoking agent-summoner to create your agent...");
      this.log("─".repeat(SEPARATOR_WIDTH));
      this.log("");

      await invokeMetaAgent({
        agentDef,
        prompt: agentPrompt,
        nonInteractive: flags["non-interactive"],
      });

      // Regenerate config-types.ts to include the new agent
      try {
        await regenerateConfigTypes(projectDir, configTypesReady, {
          extraAgentNames: [args.name],
        });
      } catch (error) {
        this.warn(`Could not update ${STANDARD_FILES.CONFIG_TYPES_TS}: ${getErrorMessage(error)}`);
      }

      this.log("");
      this.log("─".repeat(SEPARATOR_WIDTH));
      this.logSuccess("Agent creation complete!");
    } catch (error) {
      this.handleError(error);
    }
  }
}
