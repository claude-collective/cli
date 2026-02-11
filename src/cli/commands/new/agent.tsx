/**
 * Create a new custom agent using AI generation.
 *
 * This command uses the "agent-summoner" meta-agent to generate
 * a new agent scaffold with proper structure and documentation.
 */
import { Args, Flags } from "@oclif/core";
import { render, Box, Text, useInput } from "ink";
import { TextInput } from "@inkjs/ui";
import React, { useState } from "react";
import path from "path";
import { spawn } from "child_process";
import matter from "gray-matter";
import { BaseCommand } from "../../base-command.js";
import { fetchFromSource } from "../../lib/source-fetcher.js";
import { resolveSource } from "../../lib/config.js";
import { isClaudeCLIAvailable } from "../../utils/exec.js";
import { fileExists, readFile } from "../../utils/fs.js";
import { CLAUDE_DIR } from "../../consts.js";
import { EXIT_CODES } from "../../lib/exit-codes.js";

const META_AGENT_NAME = "agent-summoner";
const AGENTS_SUBDIR = ".claude/agents";

type NewAgentInput = {
  description: string;
  prompt: string;
  model?: string;
  tools?: string[];
};

type AgentSourceFrontmatter = {
  name: string;
  description: string;
  tools?: string;
  model?: string;
  permissionMode?: string;
};

type PurposeInputProps = {
  onSubmit: (purpose: string) => void;
  onCancel: () => void;
};

const PurposeInput: React.FC<PurposeInputProps> = ({ onSubmit, onCancel }) => {
  const [error, setError] = useState<string | null>(null);

  // Handle escape key for cancel
  useInput((_input, key) => {
    if (key.escape) {
      onCancel();
    }
  });

  const handleSubmit = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) {
      setError("Purpose is required");
      return;
    }
    onSubmit(trimmed);
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
          <Text color="red">{error}</Text>
        </Box>
      )}
    </Box>
  );
};

async function fetchMetaAgent(source: string, forceRefresh: boolean): Promise<NewAgentInput> {
  // Fetch the source repository
  const result = await fetchFromSource(source, {
    forceRefresh,
    subdir: AGENTS_SUBDIR,
  });

  // Read the agent-summoner.md file
  const agentPath = path.join(result.path, `${META_AGENT_NAME}.md`);

  if (!(await fileExists(agentPath))) {
    throw new Error(
      `Meta-agent not found: ${META_AGENT_NAME}.md\n\n` +
        `Expected at: ${agentPath}\n` +
        `The source repository may not contain the agent-summoner agent.`,
    );
  }

  const content = await readFile(agentPath);

  // Parse frontmatter and body
  const { data: frontmatter, content: body } = matter(content);
  const fm = frontmatter as AgentSourceFrontmatter;

  // Construct agent definition
  const tools = fm.tools ? fm.tools.split(",").map((t: string) => t.trim()) : undefined;

  return {
    description: fm.description || "Creates new agents",
    prompt: body,
    model: fm.model,
    tools,
  };
}

function buildAgentPrompt(agentName: string, purpose: string, outputDir: string): string {
  return `Create a new Claude Code agent named "${agentName}" in the directory "${outputDir}".

Agent Purpose: ${purpose}

Requirements:
1. Create the agent directory structure at ${outputDir}/${agentName}/
2. Create agent.yaml with appropriate configuration
3. Create intro.md with the agent's role and context
4. Create workflow.md with the agent's operational process
5. Optionally create examples.md if relevant examples would help
6. Optionally create critical-requirements.md for important rules

Follow the existing agent patterns in the codebase. Keep the agent focused and practical.`;
}

async function invokeMetaAgent(
  agentDef: NewAgentInput,
  prompt: string,
  nonInteractive: boolean,
): Promise<void> {
  // Construct the agents JSON
  const agentsJson = JSON.stringify({
    [META_AGENT_NAME]: {
      description: agentDef.description,
      prompt: agentDef.prompt,
      model: agentDef.model,
      tools: agentDef.tools,
    },
  });

  // Build the command arguments
  const args = ["--agents", agentsJson, "--agent", META_AGENT_NAME];

  if (nonInteractive) {
    args.push("-p", prompt);
  } else {
    // Interactive mode - let user interact with the agent
    args.push("--prompt", prompt);
  }

  // Spawn claude CLI
  return new Promise((resolve, reject) => {
    const child = spawn("claude", args, {
      stdio: "inherit",
      shell: true,
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
    refresh: Flags.boolean({
      char: "r",
      description: "Force refresh remote source",
      default: false,
    }),
    "non-interactive": Flags.boolean({
      char: "n",
      description: "Run in non-interactive mode",
      default: false,
    }),
  };

  async run(): Promise<void> {
    const { args, flags } = await this.parse(NewAgent);
    const projectDir = process.cwd();

    // Check if claude CLI is available
    const cliAvailable = await isClaudeCLIAvailable();
    if (!cliAvailable) {
      this.error(
        "Claude CLI not found. Please install it first:\n" +
          "  npm install -g @anthropic-ai/claude-code",
        { exit: EXIT_CODES.ERROR },
      );
    }

    // Resolve source
    const sourceConfig = await resolveSource(flags.source, projectDir);
    const source = sourceConfig.source;

    // Get purpose - either from flag or prompt
    let purpose = flags.purpose;

    if (!purpose) {
      // Render interactive prompt
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

    // Determine output directory
    const outputDir = path.join(projectDir, CLAUDE_DIR, "agents", "_custom");

    this.log("");
    this.log(`Agent name: ${args.name}`);
    this.log(`Purpose: ${purpose}`);
    this.log(`Output: ${outputDir}`);
    this.log("");

    this.log("Fetching agent-summoner from source...");

    try {
      // Fetch the meta-agent
      const agentDef = await fetchMetaAgent(source, flags.refresh);
      this.log("Meta-agent loaded");
      this.log("");

      // Build the prompt
      const agentPrompt = buildAgentPrompt(args.name, purpose, outputDir);

      this.log("Invoking agent-summoner to create your agent...");
      this.log("─".repeat(60));
      this.log("");

      // Invoke the meta-agent
      await invokeMetaAgent(agentDef, agentPrompt, flags["non-interactive"]);

      this.log("");
      this.log("─".repeat(60));
      this.logSuccess("Agent creation complete!");
    } catch (error) {
      this.error(error instanceof Error ? error.message : "Unknown error occurred", {
        exit: EXIT_CODES.ERROR,
      });
    }
  }
}
