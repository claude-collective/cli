import { parse as parseYaml } from "yaml";
import path from "path";
import { unique } from "remeda";
import { glob, readFile, directoryExists } from "../utils/fs";
import { verbose } from "../utils/logger";
import { CLAUDE_SRC_DIR, DIRS } from "../consts";
import type { AgentDefinition, SkillDefinition, SkillFrontmatter } from "../types";
import type { SkillId } from "../types-matrix";
import { skillFrontmatterLoaderSchema, agentYamlConfigSchema } from "./schemas";

const FRONTMATTER_REGEX = /^---\n([\s\S]*?)\n---/;

export function parseFrontmatter(content: string): SkillFrontmatter | null {
  const match = content.match(FRONTMATTER_REGEX);
  if (!match) return null;

  const yamlContent = match[1];
  const parsed = skillFrontmatterLoaderSchema.safeParse(parseYaml(yamlContent));

  if (!parsed.success) return null;
  // Boundary cast: YAML name field may not match strict SkillId pattern (e.g., local skills)
  return parsed.data as SkillFrontmatter;
}

export async function loadAllAgents(projectRoot: string): Promise<Record<string, AgentDefinition>> {
  const agents: Record<string, AgentDefinition> = {};
  const agentSourcesDir = path.join(projectRoot, DIRS.agents);

  const files = await glob("**/agent.yaml", agentSourcesDir);

  for (const file of files) {
    const fullPath = path.join(agentSourcesDir, file);
    const content = await readFile(fullPath);
    const config = agentYamlConfigSchema.parse(parseYaml(content));
    const agentPath = path.dirname(file);

    agents[config.id] = {
      title: config.title,
      description: config.description,
      model: config.model,
      tools: config.tools,
      path: agentPath,
      sourceRoot: projectRoot,
    };

    verbose(`Loaded agent: ${config.id} from ${file}`);
  }

  return agents;
}

/**
 * Load agents from project's .claude-src/agents/ directory.
 * Returns empty object if directory doesn't exist.
 */
export async function loadProjectAgents(
  projectRoot: string,
): Promise<Record<string, AgentDefinition>> {
  const agents: Record<string, AgentDefinition> = {};
  const projectAgentsDir = path.join(projectRoot, CLAUDE_SRC_DIR, "agents");

  if (!(await directoryExists(projectAgentsDir))) {
    verbose(`No project agents directory at ${projectAgentsDir}`);
    return agents;
  }

  const files = await glob("**/agent.yaml", projectAgentsDir);

  for (const file of files) {
    const fullPath = path.join(projectAgentsDir, file);
    const content = await readFile(fullPath);
    const config = agentYamlConfigSchema.parse(parseYaml(content));
    const agentPath = path.dirname(file);

    agents[config.id] = {
      title: config.title,
      description: config.description,
      model: config.model,
      tools: config.tools,
      path: agentPath,
      sourceRoot: projectRoot,
      agentBaseDir: `${CLAUDE_SRC_DIR}/agents`, // Project agents are in .claude-src/agents/
    };

    verbose(`Loaded project agent: ${config.id} from ${file}`);
  }

  return agents;
}

async function buildIdToDirectoryPathMap(skillsDir: string): Promise<Record<string, string>> {
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
  skillIds: Array<{ id: SkillId }>,
  projectRoot: string,
): Promise<Record<string, SkillDefinition>> {
  const skills: Record<string, SkillDefinition> = {};
  const skillsDir = path.join(projectRoot, DIRS.skills);

  const idToDirectoryPath = await buildIdToDirectoryPathMap(skillsDir);
  const allSkillIds = Object.keys(idToDirectoryPath);
  const expandedSkillIds: SkillId[] = [];

  for (const { id: skillId } of skillIds) {
    if (idToDirectoryPath[skillId]) {
      expandedSkillIds.push(skillId);
    } else {
      const childSkills = allSkillIds.filter((id) => {
        const dirPath = idToDirectoryPath[id];
        return dirPath.startsWith(skillId + "/");
      });

      if (childSkills.length > 0) {
        // Boundary cast: keys from buildIdToDirectoryPathMap are SkillId values from frontmatter
        expandedSkillIds.push(...(childSkills as SkillId[]));
        verbose(`Expanded directory '${skillId}' to ${childSkills.length} skills`);
      } else {
        console.warn(`  Warning: Unknown skill reference '${skillId}'`);
      }
    }
  }

  const uniqueSkillIds = unique(expandedSkillIds);

  for (const skillId of uniqueSkillIds) {
    const directoryPath = idToDirectoryPath[skillId];
    if (!directoryPath) {
      console.warn(`  Warning: Could not find skill ${skillId}: No matching skill found`);
      continue;
    }

    const skillPath = path.join(skillsDir, directoryPath);
    const skillMdPath = path.join(skillPath, "SKILL.md");

    try {
      const content = await readFile(skillMdPath);
      const frontmatter = parseFrontmatter(content);

      if (!frontmatter) {
        console.warn(`  Warning: Skipping ${skillId}: Missing or invalid frontmatter`);
        continue;
      }

      const canonicalId = frontmatter.name;
      const skillDef: SkillDefinition = {
        id: canonicalId,
        path: `${DIRS.skills}/${directoryPath}/`,
        description: frontmatter.description,
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
      console.warn(`  Warning: Skipping ${file}: Missing or invalid frontmatter`);
      continue;
    }

    const folderPath = file.replace("/SKILL.md", "");
    const skillPath = `skills/${folderPath}/`;
    const skillId = frontmatter.name;

    skills[skillId] = {
      id: skillId,
      path: skillPath,
      description: frontmatter.description,
    };

    verbose(`Loaded plugin skill: ${skillId} from ${file}`);
  }

  return skills;
}
