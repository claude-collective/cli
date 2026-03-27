import { Flags } from "@oclif/core";
import path from "path";

import { BaseCommand } from "../../base-command";
import { setVerbose } from "../../utils/logger";
import { DIRS } from "../../consts";
import {
  compileAllSkillPlugins,
  compileSkillPlugin,
  printCompilationSummary,
} from "../../lib/skills";
import { compileAllAgentPlugins, printAgentCompilationSummary } from "../../lib/agents";

const DEFAULT_OUTPUT_DIR = "dist/plugins";

export default class BuildPlugins extends BaseCommand {
  static summary = "Build skills and agents into standalone plugins";

  static description =
    "Build skills and agents into standalone plugins. By default, compiles all skills. Use --skill to compile a specific skill only. Use --agents-dir to also compile agents.";

  static examples = [
    "<%= config.bin %> <%= command.id %>",
    "<%= config.bin %> <%= command.id %> --skill cli-commander",
    "<%= config.bin %> <%= command.id %> --skills-dir ./src/skills --output-dir ./plugins",
    "<%= config.bin %> <%= command.id %> --agents-dir ./agents",
    "<%= config.bin %> <%= command.id %> --verbose",
  ];

  static flags = {
    ...BaseCommand.baseFlags,
    "skills-dir": Flags.string({
      char: "s",
      description: "Skills source directory",
      default: DIRS.skills,
    }),
    "agents-dir": Flags.string({
      char: "a",
      description: "Agents source directory (builds one plugin per agent)",
    }),
    "output-dir": Flags.string({
      char: "o",
      description: "Output directory",
      default: DEFAULT_OUTPUT_DIR,
    }),
    skill: Flags.string({
      description: "Compile only a specific skill (path to skill directory)",
    }),
    verbose: Flags.boolean({
      char: "v",
      description: "Enable verbose logging",
      default: false,
    }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(BuildPlugins);
    setVerbose(flags.verbose);

    const projectRoot = process.cwd();
    const skillsDir = path.resolve(projectRoot, flags["skills-dir"]);
    const outputDir = path.resolve(projectRoot, flags["output-dir"]);

    this.printHeader(skillsDir, outputDir);

    try {
      await this.compileSkills(flags.skill, skillsDir, outputDir);

      if (flags["agents-dir"]) {
        await this.compileAgents(projectRoot, flags["agents-dir"], outputDir);
      }

      this.log("");
      this.logSuccess("Plugin compilation complete!");
    } catch (error) {
      this.log("Compilation failed");
      this.handleError(error);
    }
  }

  private printHeader(skillsDir: string, outputDir: string): void {
    this.log("");
    this.log("Compiling skill plugins");
    this.log(`  Skills directory: ${skillsDir}`);
    this.log(`  Output directory: ${outputDir}`);
    this.log("");
  }

  private async compileSkills(
    skillFlag: string | undefined,
    skillsDir: string,
    outputDir: string,
  ): Promise<void> {
    if (skillFlag) {
      const skillPath = path.resolve(skillsDir, skillFlag);
      this.log(`Compiling skill at ${skillPath}...`);

      const result = await compileSkillPlugin({
        skillPath,
        outputDir,
      });

      this.log(`Compiled ${result.skillName}`);
      this.log(`  Plugin path: ${result.pluginPath}`);
    } else {
      this.log("Finding and compiling all skills...");

      const results = await compileAllSkillPlugins(skillsDir, outputDir);

      this.log(`Compiled ${results.length} skill plugins`);
      printCompilationSummary(results);
    }
  }

  private async compileAgents(
    projectRoot: string,
    agentsDir: string,
    outputDir: string,
  ): Promise<void> {
    const resolvedAgentsDir = path.resolve(projectRoot, agentsDir);

    this.log("");
    this.log("Compiling agent plugins");
    this.log(`  Agents directory: ${resolvedAgentsDir}`);
    this.log("");

    this.log("Finding and compiling all agents...");

    const agentResults = await compileAllAgentPlugins(resolvedAgentsDir, outputDir);

    this.log(`Compiled ${agentResults.length} agent plugins`);
    printAgentCompilationSummary(agentResults);
  }
}
