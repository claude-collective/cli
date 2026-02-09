import { Liquid } from "liquidjs";
import path from "path";
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
import { verbose } from "../utils/logger";
import { CLAUDE_DIR, CLAUDE_SRC_DIR, DIRS, OUTPUT_DIR, PROJECT_ROOT } from "../consts";
import { resolveClaudeMd } from "./resolver";
import { validateCompiledAgent, printOutputValidationResult } from "./output-validator";
import type {
  Skill,
  AgentConfig,
  CompiledAgentData,
  CompileConfig,
  CompileContext,
} from "../types";
import type { AgentName } from "../types-matrix";

async function compileAgent(
  name: string,
  agent: AgentConfig,
  projectRoot: string,
  engine: Liquid,
): Promise<string> {
  verbose(`Reading agent files for ${name}...`);

  // Use agent's sourceRoot and agentBaseDir if available (for project agents in .claude-src/agents/)
  const agentSourceRoot = agent.sourceRoot || projectRoot;
  const agentBaseDir = agent.agentBaseDir || DIRS.agents;
  const agentDir = path.join(agentSourceRoot, agentBaseDir, agent.path || name);

  const intro = await readFile(path.join(agentDir, "intro.md"));
  const workflow = await readFile(path.join(agentDir, "workflow.md"));
  const examples = await readFileOptional(
    path.join(agentDir, "examples.md"),
    "## Examples\n\n_No examples defined._",
  );
  const criticalRequirementsTop = await readFileOptional(
    path.join(agentDir, "critical-requirements.md"),
    "",
  );
  const criticalReminders = await readFileOptional(
    path.join(agentDir, "critical-reminders.md"),
    "",
  );

  const agentPath = agent.path || name;
  const category = agentPath.split("/")[0];
  const categoryDir = path.join(agentSourceRoot, agentBaseDir, category);

  let outputFormat = await readFileOptional(path.join(agentDir, "output-format.md"), "");
  if (!outputFormat) {
    outputFormat = await readFileOptional(path.join(categoryDir, "output-format.md"), "");
  }

  const preloadedSkills = agent.skills.filter((s) => s.preloaded);
  const dynamicSkills = agent.skills.filter((s) => !s.preloaded);
  const preloadedSkillIds = preloadedSkills.map((s) => s.id);

  verbose(
    `Skills for ${name}: ${preloadedSkills.length} preloaded, ${dynamicSkills.length} dynamic`,
  );

  const data: CompiledAgentData = {
    agent,
    intro,
    workflow,
    examples,
    criticalRequirementsTop,
    criticalReminders,
    outputFormat,
    skills: agent.skills,
    preloadedSkills,
    dynamicSkills,
    preloadedSkillIds,
  };

  verbose(`Rendering template for ${name}...`);
  return engine.renderFile("agent", data);
}

export async function compileAllAgents(
  resolvedAgents: Record<string, AgentConfig>,
  config: CompileConfig,
  ctx: CompileContext,
  engine: Liquid,
): Promise<void> {
  const outDir = path.join(ctx.outputDir, "agents");
  await ensureDir(outDir);

  let hasValidationIssues = false;

  for (const [name, agent] of Object.entries(resolvedAgents)) {
    try {
      const output = await compileAgent(name, agent, ctx.projectRoot, engine);
      await writeFile(path.join(outDir, `${name}.md`), output);
      console.log(`  ✓ ${name}.md`);

      const validationResult = validateCompiledAgent(output);
      if (!validationResult.valid || validationResult.warnings.length > 0) {
        hasValidationIssues = true;
        printOutputValidationResult(name as AgentName, validationResult);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`  ✗ ${name}.md - ${errorMessage}`);
      throw new Error(
        `Failed to compile agent '${name}': ${errorMessage}. Check that all required files exist in src/agents/${agent.path || name}/`,
      );
    }
  }

  if (hasValidationIssues) {
    console.log("");
  }
}

export async function compileAllSkills(
  resolvedAgents: Record<string, AgentConfig>,
  ctx: CompileContext,
): Promise<void> {
  const allSkills = Object.values(resolvedAgents)
    .flatMap((a) => a.skills)
    .filter((s) => s.path);

  const uniqueSkills = [...new Map(allSkills.map((s) => [s.id, s])).values()];

  for (const skill of uniqueSkills) {
    const id = skill.id.replace("/", "-");
    const outDir = path.join(ctx.outputDir, "skills", id);
    await ensureDir(outDir);

    const sourcePath = path.join(ctx.projectRoot, skill.path);
    const isFolder = skill.path.endsWith("/");

    try {
      if (isFolder) {
        const mainContent = await readFile(path.join(sourcePath, "SKILL.md"));
        await writeFile(path.join(outDir, "SKILL.md"), mainContent);
        console.log(`  ✓ skills/${id}/SKILL.md`);

        const referenceContent = await readFileOptional(path.join(sourcePath, "reference.md"));
        if (referenceContent) {
          await writeFile(path.join(outDir, "reference.md"), referenceContent);
          console.log(`  ✓ skills/${id}/reference.md`);
        }

        const examplesDir = path.join(sourcePath, "examples");
        if (await fileExists(examplesDir)) {
          await copy(examplesDir, path.join(outDir, "examples"));
          console.log(`  ✓ skills/${id}/examples/`);
        }

        const scriptsDir = path.join(sourcePath, "scripts");
        if (await fileExists(scriptsDir)) {
          await copy(scriptsDir, path.join(outDir, "scripts"));
          console.log(`  ✓ skills/${id}/scripts/`);
        }
      } else {
        const content = await readFile(sourcePath);
        await writeFile(path.join(outDir, "SKILL.md"), content);
        console.log(`  ✓ skills/${id}/SKILL.md`);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`  ✗ skills/${id}/SKILL.md - ${errorMessage}`);
      throw new Error(
        `Failed to compile skill '${skill.id}': ${errorMessage}. Expected skill at: ${sourcePath}`,
      );
    }
  }
}

export async function copyClaude(ctx: CompileContext): Promise<void> {
  const claudePath = await resolveClaudeMd(ctx.projectRoot, ctx.stackId, ctx.mode);

  const content = await readFile(claudePath);
  const outputPath = path.join(ctx.outputDir, "..", "CLAUDE.md");
  await writeFile(outputPath, content);
  console.log(`  ✓ CLAUDE.md (from stack)`);
}

export async function compileAllCommands(ctx: CompileContext): Promise<void> {
  const commandsDir = path.join(ctx.projectRoot, DIRS.commands);
  const outDir = path.join(ctx.outputDir, "commands");

  if (!(await fileExists(commandsDir))) {
    console.log("  - No commands directory found, skipping...");
    return;
  }

  const files = await glob("*.md", commandsDir);

  if (files.length === 0) {
    console.log("  - No commands found, skipping...");
    return;
  }

  await ensureDir(outDir);

  for (const file of files) {
    try {
      const content = await readFile(path.join(commandsDir, file));
      await writeFile(path.join(outDir, file), content);
      console.log(`  ✓ ${file}`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`  ✗ ${file} - ${errorMessage}`);
      throw new Error(
        `Failed to compile command '${file}': ${errorMessage}. Expected at: ${path.join(commandsDir, file)}`,
      );
    }
  }
}

export async function createLiquidEngine(projectDir?: string): Promise<Liquid> {
  const roots: string[] = [];

  if (projectDir) {
    // Check .claude-src/agents/_templates/ FIRST (new location)
    const srcTemplatesDir = path.join(projectDir, CLAUDE_SRC_DIR, "agents", "_templates");
    if (await directoryExists(srcTemplatesDir)) {
      roots.push(srcTemplatesDir);
      verbose(`Using local templates from: ${srcTemplatesDir}`);
    }

    // Then check .claude/templates/ as fallback (legacy location)
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

export async function cleanOutputDir(outputDir: string): Promise<void> {
  await remove(path.join(outputDir, "agents"));
  await remove(path.join(outputDir, "skills"));
  await remove(path.join(outputDir, "commands"));
}
