import { Command } from "commander";
import * as p from "@clack/prompts";
import pc from "picocolors";
import path from "path";
import { spawn } from "child_process";
import matter from "gray-matter";
import { fetchFromSource } from "../lib/source-fetcher";
import { resolveSource } from "../lib/config";
import { isClaudeCLIAvailable } from "../utils/exec";
import { fileExists, readFile } from "../utils/fs";
import { CLAUDE_DIR } from "../consts";
import { EXIT_CODES } from "../lib/exit-codes";
import { skillSubcommand } from "./new-skill";

const META_AGENT_NAME = "agent-summoner";
const AGENTS_SUBDIR = ".claude/agents";

interface NewAgentOptions {
  purpose?: string;
  source?: string;
  refresh: boolean;
  nonInteractive: boolean;
}

interface AgentDefinition {
  description: string;
  prompt: string;
  model?: string;
  tools?: string[];
}

interface AgentFrontmatter {
  name: string;
  description: string;
  tools?: string;
  model?: string;
  permissionMode?: string;
}

async function fetchMetaAgent(
  source: string,
  forceRefresh: boolean,
): Promise<AgentDefinition> {
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
  const fm = frontmatter as AgentFrontmatter;

  // Construct agent definition
  const tools = fm.tools
    ? fm.tools.split(",").map((t: string) => t.trim())
    : undefined;

  return {
    description: fm.description || "Creates new agents",
    prompt: body,
    model: fm.model,
    tools,
  };
}

function buildAgentPrompt(
  agentName: string,
  purpose: string,
  outputDir: string,
): string {
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
  agentDef: AgentDefinition,
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

async function newAgentAction(
  name: string,
  options: NewAgentOptions,
): Promise<void> {
  const projectDir = process.cwd();

  p.intro(pc.cyan("Create New Agent"));

  // Check if claude CLI is available
  const cliAvailable = await isClaudeCLIAvailable();
  if (!cliAvailable) {
    p.log.error(
      "Claude CLI not found. Please install it first:\n" +
        "  npm install -g @anthropic-ai/claude-code",
    );
    process.exit(EXIT_CODES.ERROR);
  }

  // Resolve source
  const sourceConfig = await resolveSource(options.source, projectDir);
  const source = sourceConfig.source;

  // Get purpose - either from option or prompt
  let purpose = options.purpose;
  if (!purpose) {
    const purposeResult = await p.text({
      message: "What should this agent do?",
      placeholder: "e.g., Manages database migrations with rollback support",
      validate: (value) => {
        if (!value.trim()) {
          return "Purpose is required";
        }
      },
    });

    if (p.isCancel(purposeResult)) {
      p.cancel("Cancelled");
      process.exit(EXIT_CODES.CANCELLED);
    }

    purpose = purposeResult as string;
  }

  // Determine output directory
  const outputDir = path.join(projectDir, CLAUDE_DIR, "agents", "_custom");

  p.log.info(pc.dim(`Agent name: ${name}`));
  p.log.info(pc.dim(`Purpose: ${purpose}`));
  p.log.info(pc.dim(`Output: ${outputDir}`));

  const s = p.spinner();
  s.start("Fetching agent-summoner from source...");

  try {
    // Fetch the meta-agent
    const agentDef = await fetchMetaAgent(source, options.refresh);
    s.stop("Meta-agent loaded");

    // Build the prompt
    const agentPrompt = buildAgentPrompt(name, purpose, outputDir);

    console.log("");
    p.log.info(pc.bold("Invoking agent-summoner to create your agent..."));
    console.log(pc.dim("─".repeat(60)));
    console.log("");

    // Invoke the meta-agent
    await invokeMetaAgent(agentDef, agentPrompt, options.nonInteractive);

    console.log("");
    console.log(pc.dim("─".repeat(60)));
    p.outro(pc.green("Agent creation complete!"));
  } catch (error) {
    s.stop("Failed");
    p.log.error(
      error instanceof Error ? error.message : "Unknown error occurred",
    );
    process.exit(EXIT_CODES.ERROR);
  }
}

// Export as a subcommand of "new"
export const newCommand = new Command("new")
  .description("Create new skills or agents")
  .addCommand(
    new Command("agent")
      .argument("<name>", "Name of the agent to create")
      .description("Create a new custom agent using AI generation")
      .option("-p, --purpose <purpose>", "Purpose/description of the agent")
      .option("-s, --source <source>", "Skills repository source")
      .option("-r, --refresh", "Force refresh remote source", false)
      .option("-n, --non-interactive", "Run in non-interactive mode", false)
      .action(newAgentAction),
  )
  .addCommand(skillSubcommand);
