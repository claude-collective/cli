import { parse as parseYaml } from "yaml";
import path from "path";
import { glob, readFile, directoryExists } from "../utils/fs";
import { verbose } from "../utils/logger";
import { DIRS } from "../consts";
import type {
  AgentDefinition,
  AgentYamlConfig,
  SkillDefinition,
  SkillFrontmatter,
  StackConfig,
} from "../types";

export type CompileMode = "dev";

export function getDirs(_mode: CompileMode) {
  return DIRS;
}

const FRONTMATTER_REGEX = /^---\n([\s\S]*?)\n---/;

export function parseFrontmatter(content: string): SkillFrontmatter | null {
  const match = content.match(FRONTMATTER_REGEX);
  if (!match) return null;

  const yamlContent = match[1];
  const frontmatter = parseYaml(yamlContent) as SkillFrontmatter;

  if (!frontmatter.name || !frontmatter.description) return null;
  return frontmatter;
}

function extractDisplayName(skillId: string): string {
  const withoutCategory = skillId.split("/").pop() || skillId;
  const withoutAuthor = withoutCategory.replace(/\s*\(@\w+\)$/, "").trim();
  return withoutAuthor
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export async function loadAllAgents(
  projectRoot: string,
): Promise<Record<string, AgentDefinition>> {
  const agents: Record<string, AgentDefinition> = {};
  const agentSourcesDir = path.join(projectRoot, DIRS.agents);

  const files = await glob("**/agent.yaml", agentSourcesDir);

  for (const file of files) {
    const fullPath = path.join(agentSourcesDir, file);
    const content = await readFile(fullPath);
    const config = parseYaml(content) as AgentYamlConfig;
    const agentPath = path.dirname(file);

    agents[config.id] = {
      title: config.title,
      description: config.description,
      model: config.model,
      tools: config.tools,
      path: agentPath,
    };

    verbose(`Loaded agent: ${config.id} from ${file}`);
  }

  return agents;
}

/** @deprecated Use loadSkillsByIds instead - stacks no longer embed skills */
export async function loadStackSkills(
  stackId: string,
  projectRoot: string,
  _mode: CompileMode = "dev",
): Promise<Record<string, SkillDefinition>> {
  const skills: Record<string, SkillDefinition> = {};
  const stackSkillsDir = path.join(projectRoot, DIRS.stacks, stackId, "skills");

  if (!(await directoryExists(stackSkillsDir))) {
    verbose(`No embedded skills directory for stack ${stackId}`);
    return skills;
  }

  const files = await glob("**/SKILL.md", stackSkillsDir);

  for (const file of files) {
    const fullPath = path.join(stackSkillsDir, file);
    const content = await readFile(fullPath);

    const frontmatter = parseFrontmatter(content);
    if (!frontmatter) {
      console.warn(
        `  Warning: Skipping ${file}: Missing or invalid frontmatter`,
      );
      continue;
    }

    const folderPath = file.replace("/SKILL.md", "");
    const skillPath = `src/stacks/${stackId}/skills/${folderPath}/`;
    const skillId = frontmatter.name;

    skills[skillId] = {
      path: skillPath,
      name: extractDisplayName(frontmatter.name),
      description: frontmatter.description,
      canonicalId: skillId,
    };

    verbose(`Loaded stack skill: ${skillId} from ${file}`);
  }

  return skills;
}

async function buildIdToDirectoryPathMap(
  skillsDir: string,
): Promise<Record<string, string>> {
  const map: Record<string, string> = {};
  const files = await glob("**/SKILL.md", skillsDir);

  for (const file of files) {
    const fullPath = path.join(skillsDir, file);
    const content = await readFile(fullPath);
    const frontmatter = parseFrontmatter(content);

    if (frontmatter?.name) {
      const directoryPath = file.replace("/SKILL.md", "");
      map[frontmatter.name] = directoryPath;
      map[directoryPath] = directoryPath;
    }
  }

  return map;
}

export async function loadSkillsByIds(
  skillIds: Array<{ id: string }>,
  projectRoot: string,
): Promise<Record<string, SkillDefinition>> {
  const skills: Record<string, SkillDefinition> = {};
  const skillsDir = path.join(projectRoot, DIRS.skills);

  const idToDirectoryPath = await buildIdToDirectoryPathMap(skillsDir);
  const allSkillIds = Object.keys(idToDirectoryPath);
  const expandedSkillIds: string[] = [];

  for (const { id: skillId } of skillIds) {
    if (idToDirectoryPath[skillId]) {
      expandedSkillIds.push(skillId);
    } else {
      const childSkills = allSkillIds.filter((id) => {
        const dirPath = idToDirectoryPath[id];
        return dirPath.startsWith(skillId + "/");
      });

      if (childSkills.length > 0) {
        expandedSkillIds.push(...childSkills);
        verbose(
          `Expanded directory '${skillId}' to ${childSkills.length} skills`,
        );
      } else {
        console.warn(`  Warning: Unknown skill reference '${skillId}'`);
      }
    }
  }

  const uniqueSkillIds = [...new Set(expandedSkillIds)];

  for (const skillId of uniqueSkillIds) {
    const directoryPath = idToDirectoryPath[skillId];
    if (!directoryPath) {
      console.warn(
        `  Warning: Could not find skill ${skillId}: No matching skill found`,
      );
      continue;
    }

    const skillPath = path.join(skillsDir, directoryPath);
    const skillMdPath = path.join(skillPath, "SKILL.md");

    try {
      const content = await readFile(skillMdPath);
      const frontmatter = parseFrontmatter(content);

      if (!frontmatter) {
        console.warn(
          `  Warning: Skipping ${skillId}: Missing or invalid frontmatter`,
        );
        continue;
      }

      const canonicalId = frontmatter.name;
      const skillDef: SkillDefinition = {
        path: `${DIRS.skills}/${directoryPath}/`,
        name: extractDisplayName(frontmatter.name),
        description: frontmatter.description,
        canonicalId,
      };

      skills[canonicalId] = skillDef;

      if (directoryPath !== canonicalId) {
        skills[directoryPath] = skillDef;
      }

      verbose(`Loaded skill: ${canonicalId} (from ${directoryPath})`);
    } catch (error) {
      console.warn(`  Warning: Could not load skill ${skillId}: ${error}`);
    }
  }

  return skills;
}

export async function loadPluginSkills(
  pluginDir: string,
): Promise<Record<string, SkillDefinition>> {
  const skills: Record<string, SkillDefinition> = {};
  const pluginSkillsDir = path.join(pluginDir, "skills");

  if (!(await directoryExists(pluginSkillsDir))) {
    return skills;
  }

  const files = await glob("**/SKILL.md", pluginSkillsDir);

  for (const file of files) {
    const fullPath = path.join(pluginSkillsDir, file);
    const content = await readFile(fullPath);

    const frontmatter = parseFrontmatter(content);
    if (!frontmatter) {
      console.warn(
        `  Warning: Skipping ${file}: Missing or invalid frontmatter`,
      );
      continue;
    }

    const folderPath = file.replace("/SKILL.md", "");
    const skillPath = `skills/${folderPath}/`;
    const skillId = frontmatter.name;

    skills[skillId] = {
      path: skillPath,
      name: extractDisplayName(frontmatter.name),
      description: frontmatter.description,
      canonicalId: skillId,
    };

    verbose(`Loaded plugin skill: ${skillId} from ${file}`);
  }

  return skills;
}

const stackCache = new Map<string, StackConfig>();

export async function loadStack(
  stackId: string,
  projectRoot: string,
  mode: CompileMode = "dev",
): Promise<StackConfig> {
  const cacheKey = `${mode}:${stackId}`;
  const cached = stackCache.get(cacheKey);
  if (cached) return cached;

  const dirs = getDirs(mode);
  const stackPath = path.join(projectRoot, dirs.stacks, stackId, "config.yaml");

  try {
    const content = await readFile(stackPath);
    const stack = parseYaml(content) as StackConfig;
    stackCache.set(cacheKey, stack);
    verbose(`Loaded stack: ${stack.name} (${stackId})`);
    return stack;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Failed to load stack '${stackId}': ${errorMessage}. Expected config at: ${stackPath}`,
    );
  }
}
