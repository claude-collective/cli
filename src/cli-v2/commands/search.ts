import { Args, Flags } from "@oclif/core";
import { printTable } from "@oclif/table";
import { BaseCommand } from "../base-command.js";
import { loadSkillsMatrixFromSource } from "../lib/source-loader.js";
import type { ResolvedSkill } from "../types-matrix.js";

/**
 * Maximum description width for table output
 */
const MAX_DESCRIPTION_WIDTH = 50;

/**
 * Truncate a string to a maximum length with ellipsis
 */
function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength - 3) + "...";
}

/**
 * Check if a skill matches the search query (case-insensitive)
 */
function matchesQuery(skill: ResolvedSkill, query: string): boolean {
  const lowerQuery = query.toLowerCase();

  // Match against name
  if (skill.name.toLowerCase().includes(lowerQuery)) return true;

  // Match against ID
  if (skill.id.toLowerCase().includes(lowerQuery)) return true;

  // Match against alias
  if (skill.alias?.toLowerCase().includes(lowerQuery)) return true;

  // Match against description
  if (skill.description.toLowerCase().includes(lowerQuery)) return true;

  // Match against category
  if (skill.category.toLowerCase().includes(lowerQuery)) return true;

  // Match against tags
  if (skill.tags.some((tag) => tag.toLowerCase().includes(lowerQuery))) {
    return true;
  }

  return false;
}

/**
 * Check if a skill matches the category filter (case-insensitive)
 */
function matchesCategory(skill: ResolvedSkill, category: string): boolean {
  const lowerCategory = category.toLowerCase();
  return skill.category.toLowerCase().includes(lowerCategory);
}

export default class Search extends BaseCommand {
  static summary = "Search available skills";
  static description =
    "Search skills by name, description, category, or tags and display results in a table";

  static args = {
    query: Args.string({
      description: "Search query (matches name, description, category, tags)",
      required: true,
    }),
  };

  static flags = {
    ...BaseCommand.baseFlags,
    category: Flags.string({
      char: "c",
      description: "Filter by category",
      required: false,
    }),
  };

  async run(): Promise<void> {
    const { args, flags } = await this.parse(Search);

    try {
      this.log("Loading skills...");

      const { matrix, sourcePath, isLocal } = await loadSkillsMatrixFromSource({
        sourceFlag: flags.source,
      });

      this.log(`Loaded from ${isLocal ? "local" : "remote"}: ${sourcePath}`);

      // Get all skills as array
      const allSkills = Object.values(matrix.skills);

      // Filter by query
      let results = allSkills.filter((skill) =>
        matchesQuery(skill, args.query),
      );

      // Apply category filter if provided
      if (flags.category) {
        results = results.filter((skill) =>
          matchesCategory(skill, flags.category as string),
        );
      }

      // Sort results by name
      results.sort((a, b) => a.name.localeCompare(b.name));

      // Display results
      this.log("");
      if (results.length === 0) {
        this.warn(`No skills found matching "${args.query}"`);
        if (flags.category) {
          this.logInfo(`Category filter: ${flags.category}`);
        }
      } else {
        this.logInfo(
          `Found ${results.length} skill${results.length === 1 ? "" : "s"} matching "${args.query}"`,
        );
        if (flags.category) {
          this.logInfo(`Category filter: ${flags.category}`);
        }
        this.log("");

        // Use @oclif/table for table output
        printTable({
          data: results.map((skill) => ({
            id: skill.alias || skill.id,
            category: skill.category,
            description: truncate(skill.description, MAX_DESCRIPTION_WIDTH),
          })),
          columns: [
            { key: "id", name: "ID" },
            { key: "category", name: "Category" },
            { key: "description", name: "Description" },
          ],
          headerOptions: { bold: true },
        });
      }
      this.log("");
    } catch (error) {
      this.handleError(error);
    }
  }
}
