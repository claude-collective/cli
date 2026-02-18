import { Liquid } from "liquidjs";
import path from "path";
import { pipe, flatMap, filter, uniqueBy } from "remeda";
import {
  readFile,
  readFileOptional,
  writeFile,
  ensureDir,
  remove,
  copy,
  glob,
  fileExists,
  directoryExists,
} from "../utils/fs";
import { getErrorMessage } from "../utils/errors";
import { log, verbose, warn } from "../utils/logger";
import {
  CLAUDE_DIR,
  CLAUDE_SRC_DIR,
  DIRS,
  PROJECT_ROOT,
  STANDARD_FILES,
  STANDARD_DIRS,
} from "../consts";
import { resolveClaudeMd } from "./resolver";
import { validateCompiledAgent, printOutputValidationResult } from "./output-validator";
import type { AgentConfig, AgentName, CompiledAgentData, CompileContext, Skill } from "../types";
import { typedEntries } from "../utils/typed-object";

/** Pattern matching Liquid template delimiters that could enable template injection */
const LIQUID_SYNTAX_PATTERN = /\{\{|\}\}|\{%|%\}/g;

/**
 * Strips Liquid template syntax (`{{`, `}}`, `{%`, `%}`) from a string value.
 * Prevents template injection when user-controlled data is passed to the Liquid engine.
 *
 * @param value - Input string that may contain Liquid syntax
 * @param fieldName - Name of the field (for warning messages)
 * @returns Sanitized string with Liquid delimiters removed
 */
export function sanitizeLiquidSyntax(value: string, fieldName: string): string {
  if (!LIQUID_SYNTAX_PATTERN.test(value)) return value;
  LIQUID_SYNTAX_PATTERN.lastIndex = 0;
  const sanitized = value.replace(LIQUID_SYNTAX_PATTERN, "");
  warn(`Stripped Liquid template syntax from '${fieldName}' — possible template injection attempt`);
  return sanitized;
}

function sanitizeString(value: string | undefined, fieldName: string): string | undefined {
  if (value === undefined) return undefined;
  return sanitizeLiquidSyntax(value, fieldName);
}

function sanitizeStringArray(
  values: string[] | undefined,
  fieldName: string,
): string[] | undefined {
  if (!values) return values;
  return values.map((v) => sanitizeLiquidSyntax(v, fieldName));
}

function sanitizeSkills(skills: Skill[]): Skill[] {
  return skills.map((s) => ({
    ...s,
    id: sanitizeLiquidSyntax(s.id, "skill.id") as Skill["id"],
    description: sanitizeLiquidSyntax(s.description, "skill.description"),
    usage: sanitizeLiquidSyntax(s.usage, "skill.usage"),
    pluginRef: sanitizeString(s.pluginRef, "skill.pluginRef") as Skill["pluginRef"],
  }));
}

/**
 * Sanitizes all user-controlled fields in compiled agent data to prevent
 * Liquid template injection. Strips `{{`, `}}`, `{%`, `%}` from agent
 * metadata, skill metadata, and file content before template rendering.
 */
export function sanitizeCompiledAgentData(data: CompiledAgentData): CompiledAgentData {
  const sanitizedAgent: AgentConfig = {
    ...data.agent,
    name: sanitizeLiquidSyntax(data.agent.name, "agent.name"),
    title: sanitizeLiquidSyntax(data.agent.title, "agent.title"),
    description: sanitizeLiquidSyntax(data.agent.description, "agent.description"),
    tools: sanitizeStringArray(data.agent.tools, "agent.tools") ?? data.agent.tools,
    disallowedTools: sanitizeStringArray(data.agent.disallowedTools, "agent.disallowedTools"),
    model: sanitizeString(data.agent.model, "agent.model") as AgentConfig["model"],
    permissionMode: sanitizeString(
      data.agent.permissionMode,
      "agent.permissionMode",
    ) as AgentConfig["permissionMode"],
  };

  const sanitizedSkills = sanitizeSkills(data.skills);
  const sanitizedPreloaded = sanitizeSkills(data.preloadedSkills);
  const sanitizedDynamic = sanitizeSkills(data.dynamicSkills);
  const sanitizedPreloadedIds = data.preloadedSkillIds.map(
    (id) => sanitizeLiquidSyntax(String(id), "preloadedSkillId") as typeof id,
  );

  return {
    agent: sanitizedAgent,
    intro: sanitizeLiquidSyntax(data.intro, "intro"),
    workflow: sanitizeLiquidSyntax(data.workflow, "workflow"),
    examples: sanitizeLiquidSyntax(data.examples, "examples"),
    criticalRequirementsTop: sanitizeLiquidSyntax(
      data.criticalRequirementsTop,
      "criticalRequirementsTop",
    ),
    criticalReminders: sanitizeLiquidSyntax(data.criticalReminders, "criticalReminders"),
    outputFormat: sanitizeLiquidSyntax(data.outputFormat, "outputFormat"),
    skills: sanitizedSkills,
    preloadedSkills: sanitizedPreloaded,
    dynamicSkills: sanitizedDynamic,
    preloadedSkillIds: sanitizedPreloadedIds,
  };
}

type AgentFiles = {
  intro: string;
  workflow: string;
  examples: string;
  criticalRequirementsTop: string;
  criticalReminders: string;
  outputFormat: string;
};

async function readAgentFiles(
  name: AgentName,
  agent: AgentConfig,
  projectRoot: string,
): Promise<AgentFiles> {
  const agentSourceRoot = agent.sourceRoot || projectRoot;
  const agentBaseDir = agent.agentBaseDir || DIRS.agents;
  const agentDir = path.join(agentSourceRoot, agentBaseDir, agent.path || name);

  const intro = await readFile(path.join(agentDir, STANDARD_FILES.INTRO_MD));
  const workflow = await readFile(path.join(agentDir, STANDARD_FILES.WORKFLOW_MD));
  const examples = await readFileOptional(
    path.join(agentDir, STANDARD_FILES.EXAMPLES_MD),
    "## Examples\n\n_No examples defined._",
  );
  const criticalRequirementsTop = await readFileOptional(
    path.join(agentDir, STANDARD_FILES.CRITICAL_REQUIREMENTS_MD),
    "",
  );
  const criticalReminders = await readFileOptional(
    path.join(agentDir, STANDARD_FILES.CRITICAL_REMINDERS_MD),
    "",
  );

  const agentPath = agent.path || name;
  const parts = agentPath.split("/");
  const category = parts[0] || name;
  const categoryDir = path.join(agentSourceRoot, agentBaseDir, category);

  let outputFormat = await readFileOptional(
    path.join(agentDir, STANDARD_FILES.OUTPUT_FORMAT_MD),
    "",
  );
  if (!outputFormat) {
    outputFormat = await readFileOptional(
      path.join(categoryDir, STANDARD_FILES.OUTPUT_FORMAT_MD),
      "",
    );
  }

  return { intro, workflow, examples, criticalRequirementsTop, criticalReminders, outputFormat };
}

function buildAgentTemplateContext(
  name: AgentName,
  agent: AgentConfig,
  files: AgentFiles,
): CompiledAgentData {
  const preloadedSkills = agent.skills.filter((s) => s.preloaded);
  const dynamicSkills = agent.skills.filter((s) => !s.preloaded);
  const preloadedSkillIds = preloadedSkills.map((s) => s.id);

  verbose(
    `Skills for ${name}: ${preloadedSkills.length} preloaded, ${dynamicSkills.length} dynamic`,
  );

  return {
    agent,
    ...files,
    skills: agent.skills,
    preloadedSkills,
    dynamicSkills,
    preloadedSkillIds,
  };
}

/**
 * Compiles a single agent into a rendered Markdown prompt by reading its
 * constituent files (intro, workflow, examples, critical requirements/reminders,
 * output format) and rendering them through a Liquid template.
 *
 * Skills are split into preloaded (content embedded in the compiled agent) and
 * dynamic (loaded via Skill tool at runtime). Output format resolution falls back
 * from the agent-specific directory to the parent category directory.
 *
 * @param name - Agent identifier used for logging and as a directory name fallback
 * @param agent - Fully resolved agent config including skills, paths, and optional sourceRoot
 * @param projectRoot - Root directory of the project (used as base for agent file resolution)
 * @param engine - Pre-configured Liquid template engine with template roots
 * @returns Rendered Markdown string ready to be written to the output directory
 * @throws When required agent files (intro.md, workflow.md) are missing from disk
 */
async function compileAgent(
  name: AgentName,
  agent: AgentConfig,
  projectRoot: string,
  engine: Liquid,
): Promise<string> {
  verbose(`Reading agent files for ${name}...`);
  const files = await readAgentFiles(name, agent, projectRoot);
  const data = buildAgentTemplateContext(name, agent, files);

  verbose(`Rendering template for ${name}...`);
  return engine.renderFile("agent", sanitizeCompiledAgentData(data));
}

/**
 * Compiles all resolved agents into Markdown files and writes them to the output directory.
 *
 * Each agent is compiled via `compileAgent()`, validated for structural issues
 * (missing sections, placeholder text), and written to `{outputDir}/agents/{name}.md`.
 * Validation warnings are printed but do not prevent compilation.
 *
 * @param resolvedAgents - Map of agent names to fully resolved agent configs with skills
 * @param ctx - Compilation context providing projectRoot and outputDir paths
 * @param engine - Pre-configured Liquid template engine
 * @throws When any agent fails to compile (missing files, template errors)
 */
export async function compileAllAgents(
  resolvedAgents: Record<AgentName, AgentConfig>,
  ctx: CompileContext,
  engine: Liquid,
): Promise<void> {
  const outDir = path.join(ctx.outputDir, "agents");
  await ensureDir(outDir);

  let hasValidationIssues = false;

  for (const [name, agent] of typedEntries<AgentName, AgentConfig>(resolvedAgents)) {
    try {
      const output = await compileAgent(name, agent, ctx.projectRoot, engine);
      await writeFile(path.join(outDir, `${name}.md`), output);
      log(`  ✓ ${name}.md`);

      const validationResult = validateCompiledAgent(output);
      if (!validationResult.valid || validationResult.warnings.length > 0) {
        hasValidationIssues = true;
        printOutputValidationResult(name, validationResult);
      }
    } catch (error) {
      const errorMessage = getErrorMessage(error);
      warn(`Failed to compile '${name}': ${errorMessage}`);
      throw new Error(
        `Failed to compile agent '${name}': ${errorMessage}. Check that all required files exist in src/agents/${agent.path || name}/`,
      );
    }
  }

  if (hasValidationIssues) {
    log("");
  }
}

/**
 * Copies all skill files referenced by resolved agents into the output directory.
 *
 * Deduplicates skills across agents (by skill ID) and copies each skill's
 * content to `{outputDir}/skills/{id}/`. For folder-based skills, copies
 * SKILL.md, optional reference.md, examples/, and scripts/ subdirectories.
 * For single-file skills, copies the file as SKILL.md.
 *
 * @param resolvedAgents - Map of agent names to configs (skills extracted from all agents)
 * @param ctx - Compilation context providing projectRoot and outputDir paths
 * @throws When a skill file or directory is missing from the expected source path
 */
export async function compileAllSkills(
  resolvedAgents: Record<AgentName, AgentConfig>,
  ctx: CompileContext,
): Promise<void> {
  const allSkills = pipe(
    Object.values(resolvedAgents),
    flatMap((a) => a.skills),
    filter((s) => Boolean(s.path)),
  );

  const uniqueSkills = uniqueBy(allSkills, (s) => s.id);

  for (const skill of uniqueSkills) {
    const id = skill.id.replace("/", "-");
    const outDir = path.join(ctx.outputDir, "skills", id);
    await ensureDir(outDir);

    const sourcePath = path.join(ctx.projectRoot, skill.path);
    const isFolder = skill.path.endsWith("/");

    try {
      if (isFolder) {
        const mainContent = await readFile(path.join(sourcePath, STANDARD_FILES.SKILL_MD));
        await writeFile(path.join(outDir, STANDARD_FILES.SKILL_MD), mainContent);
        log(`  ✓ skills/${id}/${STANDARD_FILES.SKILL_MD}`);

        const referenceContent = await readFileOptional(
          path.join(sourcePath, STANDARD_FILES.REFERENCE_MD),
        );
        if (referenceContent) {
          await writeFile(path.join(outDir, STANDARD_FILES.REFERENCE_MD), referenceContent);
          log(`  ✓ skills/${id}/${STANDARD_FILES.REFERENCE_MD}`);
        }

        const examplesDir = path.join(sourcePath, STANDARD_DIRS.EXAMPLES);
        if (await fileExists(examplesDir)) {
          await copy(examplesDir, path.join(outDir, STANDARD_DIRS.EXAMPLES));
          log(`  ✓ skills/${id}/${STANDARD_DIRS.EXAMPLES}/`);
        }

        const scriptsDir = path.join(sourcePath, STANDARD_DIRS.SCRIPTS);
        if (await fileExists(scriptsDir)) {
          await copy(scriptsDir, path.join(outDir, STANDARD_DIRS.SCRIPTS));
          log(`  ✓ skills/${id}/${STANDARD_DIRS.SCRIPTS}/`);
        }
      } else {
        const content = await readFile(sourcePath);
        await writeFile(path.join(outDir, STANDARD_FILES.SKILL_MD), content);
        log(`  ✓ skills/${id}/${STANDARD_FILES.SKILL_MD}`);
      }
    } catch (error) {
      const errorMessage = getErrorMessage(error);
      warn(`Failed to compile skill '${id}': ${errorMessage}`);
      throw new Error(
        `Failed to compile skill '${skill.id}': ${errorMessage}. Expected skill at: ${sourcePath}`,
      );
    }
  }
}

/**
 * Copies the stack-specific CLAUDE.md file to the compilation output directory.
 *
 * Resolves the CLAUDE.md path from the stack directory, reads its content, and
 * writes it to the parent of the output directory (alongside the agents/ folder).
 *
 * @param ctx - Compilation context with stackId, projectRoot, and outputDir
 * @throws When the stack's CLAUDE.md file is missing
 */
export async function copyClaudeMdToOutput(ctx: CompileContext): Promise<void> {
  const claudePath = await resolveClaudeMd(ctx.projectRoot, ctx.stackId);

  const content = await readFile(claudePath);
  const outputPath = path.join(ctx.outputDir, "..", STANDARD_FILES.CLAUDE_MD);
  await writeFile(outputPath, content);
  log(`  ✓ ${STANDARD_FILES.CLAUDE_MD} (from stack)`);
}

/**
 * Copies all custom command Markdown files from the commands source directory
 * to the compilation output directory.
 *
 * Skips gracefully if no commands directory exists or contains no .md files.
 *
 * @param ctx - Compilation context with projectRoot and outputDir
 * @throws When a command file exists but cannot be read or written
 */
export async function compileAllCommands(ctx: CompileContext): Promise<void> {
  const commandsDir = path.join(ctx.projectRoot, DIRS.commands);
  const outDir = path.join(ctx.outputDir, "commands");

  if (!(await fileExists(commandsDir))) {
    log("  - No commands directory found, skipping...");
    return;
  }

  const files = await glob("*.md", commandsDir);

  if (files.length === 0) {
    log("  - No commands found, skipping...");
    return;
  }

  await ensureDir(outDir);

  for (const file of files) {
    try {
      const content = await readFile(path.join(commandsDir, file));
      await writeFile(path.join(outDir, file), content);
      log(`  ✓ ${file}`);
    } catch (error) {
      const errorMessage = getErrorMessage(error);
      warn(`Failed to compile command '${file}': ${errorMessage}`);
      throw new Error(
        `Failed to compile command '${file}': ${errorMessage}. Expected at: ${path.join(commandsDir, file)}`,
      );
    }
  }
}

/**
 * Creates a Liquid template engine with a layered template root hierarchy.
 *
 * Template resolution order (first match wins):
 * 1. Project-local templates: `{projectDir}/.claude-src/agents/_templates/`
 * 2. Legacy templates: `{projectDir}/.claude/templates/`
 * 3. Built-in templates: `{PROJECT_ROOT}/templates/`
 *
 * @param projectDir - Optional project directory for local template overrides
 * @returns Configured Liquid engine with `.liquid` extension and strict filters
 */
export async function createLiquidEngine(projectDir?: string): Promise<Liquid> {
  const roots: string[] = [];

  if (projectDir) {
    const srcTemplatesDir = path.join(projectDir, CLAUDE_SRC_DIR, "agents", "_templates");
    if (await directoryExists(srcTemplatesDir)) {
      roots.push(srcTemplatesDir);
      verbose(`Using local templates from: ${srcTemplatesDir}`);
    }

    const legacyTemplatesDir = path.join(projectDir, CLAUDE_DIR, "templates");
    if (await directoryExists(legacyTemplatesDir)) {
      roots.push(legacyTemplatesDir);
      verbose(`Using legacy templates from: ${legacyTemplatesDir}`);
    }
  }

  roots.push(path.join(PROJECT_ROOT, DIRS.templates));

  return new Liquid({
    root: roots,
    extname: ".liquid",
    strictVariables: false,
    strictFilters: true,
  });
}

/** Removes the agents/, skills/, and commands/ subdirectories from the output directory. */
export async function removeCompiledOutputDirs(outputDir: string): Promise<void> {
  await remove(path.join(outputDir, "agents"));
  await remove(path.join(outputDir, "skills"));
  await remove(path.join(outputDir, "commands"));
}
