import path from "path";
import { mkdir, writeFile } from "fs/promises";
import { stringify as stringifyYaml } from "yaml";
import { STANDARD_FILES } from "../../../consts";
import { matrix } from "../../matrix/matrix-provider";
import { computeSkillFolderHash } from "../../versioning";
import { renderSkillMd, renderAgentYaml } from "../content-generators";
import type { SkillId } from "../../../types";
import type { TestSkill } from "../fixtures/create-test-source";

export async function writeTestSkill(
  skillsDir: string,
  skillId: SkillId,
  options?: {
    /** Extra fields to merge into metadata.yaml (e.g., forkedFrom, displayName) */
    extraMetadata?: Record<string, unknown>;
    /** Skip metadata.yaml creation entirely */
    skipMetadata?: boolean;
    /** Custom SKILL.md content (overrides default generated content) */
    skillContent?: string;
  },
): Promise<string> {
  const skill = matrix.skills[skillId];

  if (!options?.skipMetadata && !skill) {
    throw new Error(
      `writeTestSkill: "${skillId}" not found in matrix store — populate the store in beforeEach`,
    );
  }

  const skillDir = path.join(skillsDir, skillId);
  await mkdir(skillDir, { recursive: true });

  await writeFile(
    path.join(skillDir, STANDARD_FILES.SKILL_MD),
    options?.skillContent ?? renderSkillMd(skillId, skill?.description),
  );

  if (!options?.skipMetadata && skill) {
    const { slug, category, author } = skill;
    const domain = category.split("-")[0];

    const contentHash = await computeSkillFolderHash(skillDir);
    const baseMetadata = {
      author,
      category,
      domain,
      slug,
      contentHash,
    };
    await writeFile(
      path.join(skillDir, STANDARD_FILES.METADATA_YAML),
      stringifyYaml({ ...baseMetadata, ...options?.extraMetadata }),
    );
  }

  return skillDir;
}

/**
 * Creates a source-level skill directory with SKILL.md and rich metadata.yaml.
 * Use this when testing `extractAllSkills()` and `mergeMatrixWithSkills()`.
 *
 * Unlike `writeTestSkill()` which creates installed skills, this writes skills
 * in the source directory layout (under `src/skills/<domain>/<category>/<name>/`).
 */
export async function writeSourceSkill(
  skillsDir: string,
  directoryPath: string,
  config: TestSkill,
): Promise<string> {
  const skillDir = path.join(skillsDir, directoryPath);
  await mkdir(skillDir, { recursive: true });

  await writeFile(
    path.join(skillDir, STANDARD_FILES.SKILL_MD),
    renderSkillMd(config.id, config.description),
  );

  const domain = config.domain;
  const slug = config.slug;
  const metadata: Record<string, unknown> = {
    displayName: config.id,
    slug,
    category: config.category,
    domain,
    author: config.author ?? "@test",
  };

  await writeFile(path.join(skillDir, STANDARD_FILES.METADATA_YAML), stringifyYaml(metadata));

  return skillDir;
}

export async function writeTestAgent(
  agentsDir: string,
  agentName: string,
  options?: { description?: string },
): Promise<string> {
  const agentDir = path.join(agentsDir, agentName);
  await mkdir(agentDir, { recursive: true });

  await writeFile(
    path.join(agentDir, STANDARD_FILES.AGENT_METADATA_YAML),
    renderAgentYaml(agentName, options?.description),
  );

  return agentDir;
}
