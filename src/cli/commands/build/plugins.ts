import { Flags } from "@oclif/core";
import path from "path";
import { BaseCommand } from "../../base-command";
import { setVerbose } from "../../utils/logger";
import { DIRS } from "../../consts";
import {
  compileAllSkillPlugins,
  compileSkillPlugin,
  printCompilationSummary,
} from "../../lib/skill-plugin-compiler";
import { EXIT_CODES } from "../../lib/exit-codes";

const DEFAULT_OUTPUT_DIR = "dist/plugins";

export default class BuildPlugins extends BaseCommand {
  static summary =
    "Build skills into standalone plugins (requires skills repo)";

  static description =
    "Build skills into standalone plugins. By default, compiles all skills. Use --skill to compile a specific skill only.";

  static examples = [
    "<%= config.bin %> <%= command.id %>",
    "<%= config.bin %> <%= command.id %> --skill cli-commander",
    "<%= config.bin %> <%= command.id %> --skills-dir ./src/skills --output-dir ./plugins",
    "<%= config.bin %> <%= command.id %> --verbose",
  ];

  static flags = {
    ...BaseCommand.baseFlags,
    "skills-dir": Flags.string({
      char: "s",
      description: "Skills source directory",
      default: DIRS.skills,
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

    this.log("");
    this.log("Compiling skill plugins");
    this.log(`  Skills directory: ${skillsDir}`);
    this.log(`  Output directory: ${outputDir}`);
    this.log("");

    try {
      if (flags.skill) {
        const skillPath = path.resolve(skillsDir, flags.skill);
        this.log(`Compiling skill at ${skillPath}...`);

        const result = await compileSkillPlugin({
          skillPath,
          outputDir,
        });

        this.log(`Compiled skill-${result.skillName}`);
        this.log(`  Plugin path: ${result.pluginPath}`);
      } else {
        this.log("Finding and compiling all skills...");

        const results = await compileAllSkillPlugins(skillsDir, outputDir);

        this.log(`Compiled ${results.length} skill plugins`);
        printCompilationSummary(results);
      }

      this.log("");
      this.logSuccess("Plugin compilation complete!");
    } catch (error) {
      this.log("Compilation failed");
      this.error(error instanceof Error ? error.message : String(error), {
        exit: EXIT_CODES.ERROR,
      });
    }
  }
}
