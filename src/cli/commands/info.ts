import { Args, Flags } from "@oclif/core";
import path from "path";
import { BaseCommand } from "../base-command.js";
import { loadSkillsMatrixFromSource } from "../lib/loading/index.js";
import { discoverLocalSkills } from "../lib/skills/index.js";
import { fileExists, readFile } from "../utils/fs.js";
import { CLI_BIN_NAME, STANDARD_FILES } from "../consts.js";
import { EXIT_CODES } from "../lib/exit-codes.js";
import { STATUS_MESSAGES } from "../utils/messages.js";
import type {
  ResolvedSkill,
  SkillDisplayName,
  SkillId,
  SkillRelation,
  SkillRequirement,
} from "../types/index.js";

const CONTENT_PREVIEW_LINES = 10;
const MAX_LINE_LENGTH = 80;
const MAX_SUGGESTIONS = 5;

function stripFrontmatter(content: string): string {
  const lines = content.split("\n");
  let inFrontmatter = false;
  let frontmatterEndIndex = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line === "---") {
      if (!inFrontmatter) {
        inFrontmatter = true;
      } else {
        frontmatterEndIndex = i + 1;
        break;
      }
    }
  }

  return lines.slice(frontmatterEndIndex).join("\n");
}

function getPreviewLines(content: string, maxLines: number): string[] {
  const body = stripFrontmatter(content);
  const lines = body.split("\n");
  const result: string[] = [];

  for (const line of lines) {
    if (result.length >= maxLines) break;
    if (line.trim() || result.length > 0) {
      const truncated =
        line.length > MAX_LINE_LENGTH ? `${line.slice(0, MAX_LINE_LENGTH - 3)}...` : line;
      result.push(truncated);
    }
  }

  return result;
}

function formatRelations(relations: SkillRelation[]): string {
  if (relations.length === 0) {
    return "(none)";
  }
  return relations.map((r) => r.skillId).join(", ");
}

function formatRequirements(requirements: SkillRequirement[]): string {
  if (requirements.length === 0) {
    return "(none)";
  }
  return requirements
    .map((req) => {
      const prefix = req.needsAny ? "any of: " : "";
      return prefix + req.skillIds.join(", ");
    })
    .join("; ");
}

function formatTags(tags: string[]): string {
  if (tags.length === 0) {
    return "(none)";
  }
  return tags.join(", ");
}

function findSuggestions(
  skills: Partial<Record<SkillId, ResolvedSkill>>,
  query: string,
  maxSuggestions: number,
): string[] {
  const lowerQuery = query.toLowerCase();
  const matches: string[] = [];

  for (const skill of Object.values(skills)) {
    if (!skill) continue;
    if (matches.length >= maxSuggestions) break;
    if (
      skill.id.toLowerCase().includes(lowerQuery) ||
      skill.displayName?.toLowerCase().includes(lowerQuery)
    ) {
      matches.push(skill.id);
    }
  }

  return matches;
}

function formatSkillInfo(skill: ResolvedSkill, isInstalled: boolean): string {
  const lines: string[] = [];

  lines.push(`Skill: ${skill.id}`);
  if (skill.displayName) {
    lines.push(`Alias: ${skill.displayName}`);
  }
  lines.push(`Author: ${skill.author}`);
  lines.push(`Category: ${skill.category}`);
  lines.push("");
  lines.push("Description:");
  lines.push(`  ${skill.description}`);
  lines.push("");
  lines.push(`Tags: ${formatTags(skill.tags)}`);
  lines.push("");
  lines.push(`Requires: ${formatRequirements(skill.requires)}`);
  lines.push(`Conflicts with: ${formatRelations(skill.conflictsWith)}`);
  lines.push(`Recommends: ${formatRelations(skill.recommends)}`);

  if (skill.usageGuidance) {
    lines.push("");
    lines.push("Usage Guidance:");
    lines.push(`  ${skill.usageGuidance}`);
  }

  lines.push("");
  lines.push(`Local Status: ${isInstalled ? "Installed" : "Not installed"}`);

  return lines.join("\n");
}

export default class Info extends BaseCommand {
  static summary = "Show detailed information about a skill";
  static description =
    "Display comprehensive information about a skill including metadata, relationships, and content preview";

  static examples = [
    {
      description: "Show info for a skill by ID",
      command: "<%= config.bin %> <%= command.id %> web-framework-react",
    },
    {
      description: "Show info without content preview",
      command: "<%= config.bin %> <%= command.id %> web-framework-react --no-preview",
    },
    {
      description: "Show info from a custom source",
      command: "<%= config.bin %> <%= command.id %> my-skill --source github:org/marketplace",
    },
  ];

  static args = {
    skill: Args.string({
      description: "Skill ID or alias to look up",
      required: true,
    }),
  };

  static flags = {
    ...BaseCommand.baseFlags,
    preview: Flags.boolean({
      description: "Show content preview from SKILL.md",
      default: true,
      allowNo: true,
    }),
  };

  async run(): Promise<void> {
    const { args, flags } = await this.parse(Info);

    try {
      this.log(STATUS_MESSAGES.LOADING_SKILLS);

      const { matrix, sourcePath, isLocal } = await loadSkillsMatrixFromSource({
        sourceFlag: flags.source,
      });

      this.log(`Loaded from ${isLocal ? "local" : "remote"}: ${sourcePath}`);

      // CLI arg is an untyped string — cast at data boundary
      let skill: ResolvedSkill | undefined = matrix.skills[args.skill as SkillId];

      if (!skill) {
        // Try alias lookup — CLI arg is an untyped string
        const fullId = matrix.displayNameToId[args.skill as SkillDisplayName];
        if (fullId) {
          skill = matrix.skills[fullId];
        }
      }

      if (!skill) {
        const suggestions = findSuggestions(matrix.skills, args.skill, MAX_SUGGESTIONS);

        this.log("");
        this.error(`Skill "${args.skill}" not found.`, { exit: false });

        if (suggestions.length > 0) {
          this.log("");
          this.log("Did you mean one of these?");
          for (const suggestion of suggestions) {
            this.log(`  - ${suggestion}`);
          }
        }

        this.log("");
        this.logInfo(`Use '${CLI_BIN_NAME} search <query>' to find available skills.`);
        this.log("");
        this.exit(EXIT_CODES.ERROR);
      }

      const localSkillsResult = await discoverLocalSkills(process.cwd());
      const localSkillIds = localSkillsResult?.skills.map((s) => s.id) || [];
      const isInstalled = localSkillIds.includes(skill.id);

      this.log("");
      this.log(formatSkillInfo(skill, isInstalled));

      if (flags.preview) {
        let skillMdPath: string;

        if (skill.local && skill.localPath) {
          skillMdPath = path.join(process.cwd(), skill.localPath, STANDARD_FILES.SKILL_MD);
        } else {
          const sourceDir = isLocal ? sourcePath : path.dirname(sourcePath);
          skillMdPath = path.join(sourceDir, skill.path, STANDARD_FILES.SKILL_MD);
        }

        if (await fileExists(skillMdPath)) {
          const content = await readFile(skillMdPath);
          const previewLines = getPreviewLines(content, CONTENT_PREVIEW_LINES);

          if (previewLines.length > 0) {
            this.log("");
            this.log(`--- Content Preview (first ${CONTENT_PREVIEW_LINES} lines) ---`);
            for (const line of previewLines) {
              this.log(line);
            }
          }
        }
      }

      this.log("");
    } catch (error) {
      this.handleError(error);
    }
  }
}
