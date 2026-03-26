import { spawn } from "child_process";
import matter from "gray-matter";
import path from "path";

import { CLAUDE_DIR } from "../../consts.js";
import { getAgentDefinitions } from "../agents/index.js";
import { fileExists, readFile } from "../../utils/fs.js";

const META_AGENT_NAME = "agent-summoner";

export type NewAgentInput = {
  description: string;
  prompt: string;
  model?: string;
  tools?: string[];
};

export type LoadMetaAgentOptions = {
  projectDir: string;
  source: string;
  forceRefresh: boolean;
};

export type InvokeMetaAgentOptions = {
  agentDef: NewAgentInput;
  prompt: string;
  nonInteractive: boolean;
};

/**
 * Parses a compiled agent markdown file to extract the agent definition.
 *
 * Reads YAML frontmatter for description/model/tools and the body as the prompt.
 */
export function parseCompiledAgent(content: string): NewAgentInput {
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

/**
 * Loads the meta-agent (agent-summoner) from either a compiled local agent
 * or a remote source. Parses the compiled agent markdown.
 *
 * @throws {Error} If the meta-agent cannot be found locally or remotely.
 */
export async function loadMetaAgent(options: LoadMetaAgentOptions): Promise<NewAgentInput> {
  const { projectDir, source, forceRefresh } = options;
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

/**
 * Constructs the prompt for the meta-agent based on user input.
 */
export function buildAgentPrompt(agentName: string, purpose: string, outputDir: string): string {
  return `Create a new Claude Code agent named "${agentName}" in the directory "${outputDir}".

Agent Purpose: ${purpose}

Requirements:
1. Create the agent directory structure at ${outputDir}/${agentName}/
2. Create metadata.yaml with appropriate configuration
3. Create intro.md with the agent's role and context
4. Create workflow.md with the agent's operational process
5. Optionally create examples.md if relevant examples would help
6. Optionally create critical-requirements.md for important rules
7. Include \`custom: true\` in the metadata.yaml configuration

Follow the existing agent patterns in the codebase. Keep the agent focused and practical.`;
}

/**
 * Spawns the Claude CLI to execute the meta-agent with the constructed prompt.
 *
 * Uses `stdio: "inherit"` so the CLI output streams directly to the terminal.
 *
 * @throws {Error} If the Claude CLI fails to spawn or exits with a non-zero code.
 */
export async function invokeMetaAgent(options: InvokeMetaAgentOptions): Promise<void> {
  const { agentDef, prompt, nonInteractive } = options;

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
