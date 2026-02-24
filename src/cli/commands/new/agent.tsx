import React, { useState } from "react";

import { Args, Flags } from "@oclif/core";
import { TextInput } from "@inkjs/ui";
import { spawn } from "child_process";
import matter from "gray-matter";
import { render, Box, Text, useApp, useInput } from "ink";
import path from "path";

import { BaseCommand } from "../../base-command.js";
import { CLAUDE_DIR, CLI_COLORS } from "../../consts.js";
import { getAgentDefinitions } from "../../lib/agents/index.js";
import { resolveSource } from "../../lib/configuration/index.js";
import { EXIT_CODES } from "../../lib/exit-codes.js";
import { isClaudeCLIAvailable } from "../../utils/exec.js";
import { fileExists, readFile } from "../../utils/fs.js";

const META_AGENT_NAME = "agent-summoner";

type NewAgentInput = {
  description: string;
  prompt: string;
  model?: string;
  tools?: string[];
};

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

function parseCompiledAgent(content: string): NewAgentInput {
  const { data: frontmatter, content: body } = matter(content);
  const tools =
    typeof frontmatter.tools === "string"
      ? frontmatter.tools.split(",").map((t: string) => t.trim())
      : frontmatter.tools;

  return {
    description: frontmatter.description || "Creates new agents",
    prompt: body.trim(),
    model: frontmatter.model,
    tools,
  };
}

async function loadMetaAgent(
  projectDir: string,
  source: string,
  forceRefresh: boolean,
): Promise<NewAgentInput> {
  const compiledFileName = `${META_AGENT_NAME}.md`;

  // Check for compiled agent in the current project
  const localAgentPath = path.join(projectDir, CLAUDE_DIR, "agents", compiledFileName);
  if (await fileExists(localAgentPath)) {
    return parseCompiledAgent(await readFile(localAgentPath));
  }

  // Fall back to remote source (may not have agents)
  try {
    const agentPaths = await getAgentDefinitions(source, { forceRefresh, projectDir });
    const remoteAgentPath = path.join(
      agentPaths.sourcePath,
      CLAUDE_DIR,
      "agents",
      compiledFileName,
    );
    if (await fileExists(remoteAgentPath)) {
      return parseCompiledAgent(await readFile(remoteAgentPath));
    }
  } catch {
    // Source does not contain agents — fall through to error
  }

  throw new Error(
    `Agent '${META_AGENT_NAME}' not found.\n\n` + `Run 'compile' first to generate agents.`,
  );
}

export function buildAgentPrompt(agentName: string, purpose: string, outputDir: string): string {
  return `Create a new Claude Code agent named "${agentName}" in the directory "${outputDir}".

Agent Purpose: ${purpose}

Requirements:
1. Create the agent directory structure at ${outputDir}/${agentName}/
2. Create agent.yaml with appropriate configuration
3. Create intro.md with the agent's role and context
4. Create workflow.md with the agent's operational process
5. Optionally create examples.md if relevant examples would help
6. Optionally create critical-requirements.md for important rules
7. Include \`custom: true\` in the agent.yaml configuration

Follow the existing agent patterns in the codebase. Keep the agent focused and practical.`;
}

async function invokeMetaAgent(
  agentDef: NewAgentInput,
  prompt: string,
  nonInteractive: boolean,
): Promise<void> {
  const agentsJson = JSON.stringify({
    [META_AGENT_NAME]: {
      description: agentDef.description,
      prompt: agentDef.prompt,
      model: agentDef.model,
      tools: agentDef.tools,
    },
  });

  const args = ["--agents", agentsJson, "--agent", META_AGENT_NAME];

  if (nonInteractive) {
    args.push("-p", prompt);
  } else {
    args.push("--prompt", prompt);
  }

  return new Promise((resolve, reject) => {
    const child = spawn("claude", args, {
      stdio: "inherit",
    });

    child.on("error", (error) => {
      reject(new Error(`Failed to spawn claude CLI: ${error.message}`));
    });

    child.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Claude CLI exited with code ${code}`));
      }
    });
  });
}

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
      const agentDef = await loadMetaAgent(projectDir, sourceConfig.source, flags.refresh);
      this.log("Meta-agent loaded");
      this.log("");

      const agentPrompt = buildAgentPrompt(args.name, purpose, outputDir);

      this.log("Invoking agent-summoner to create your agent...");
      this.log("─".repeat(60));
      this.log("");

      await invokeMetaAgent(agentDef, agentPrompt, flags["non-interactive"]);

      this.log("");
      this.log("─".repeat(60));
      this.logSuccess("Agent creation complete!");
    } catch (error) {
      this.handleError(error);
    }
  }
}
