import { Args, Flags } from "@oclif/core";
import path from "path";
import { BaseCommand } from "../base-command.js";
import { EXIT_CODES } from "../lib/exit-codes.js";
import {
  validateAllSchemas,
  printValidationResults,
} from "../lib/schema-validator.js";
import {
  validatePlugin,
  validateAllPlugins,
  printPluginValidationResult,
} from "../lib/plugin-validator.js";

export default class Validate extends BaseCommand {
  static summary =
    "Validate YAML files against schemas or validate compiled plugins";
  static description =
    "Validates skill/agent YAML files against JSON schemas, or validates compiled plugin structure and content. " +
    "Without arguments, validates all YAML files in the current directory against their schemas. " +
    "With a path argument or --plugins flag, validates plugin(s) instead.";

  static args = {
    path: Args.string({
      description: "Path to plugin or plugins directory to validate",
      required: false,
    }),
  };

  static flags = {
    ...BaseCommand.baseFlags,
    verbose: Flags.boolean({
      char: "v",
      description: "Enable verbose logging",
      default: false,
    }),
    all: Flags.boolean({
      char: "a",
      description: "Validate all plugins in directory",
      default: false,
    }),
    plugins: Flags.boolean({
      char: "p",
      description: "Validate plugins instead of schemas",
      default: false,
    }),
  };

  async run(): Promise<void> {
    const { args, flags } = await this.parse(Validate);

    if (args.path || flags.plugins) {
      await this.validatePlugins(args.path, flags.verbose, flags.all);
    } else {
      await this.validateSchemas();
    }
  }

  private async validateSchemas(): Promise<void> {
    this.log("");
    this.log("Validating all schemas");
    this.log("");

    try {
      const result = await validateAllSchemas();

      const summary = result.valid
        ? `Done: ${result.summary.validFiles}/${result.summary.totalFiles} files valid`
        : `Done: ${result.summary.invalidFiles} invalid files`;

      this.log(summary);
      printValidationResults(result);

      if (!result.valid) {
        this.exit(EXIT_CODES.ERROR);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.error(`Validation failed: ${message}`, { exit: EXIT_CODES.ERROR });
    }
  }

  private async validatePlugins(
    pluginPath: string | undefined,
    verbose: boolean,
    all: boolean,
  ): Promise<void> {
    const targetPath = pluginPath ? path.resolve(pluginPath) : process.cwd();

    if (all) {
      await this.validateAllPluginsInDirectory(targetPath, verbose);
    } else {
      await this.validateSinglePlugin(targetPath, verbose);
    }
  }

  private async validateAllPluginsInDirectory(
    targetPath: string,
    verbose: boolean,
  ): Promise<void> {
    this.log("");
    this.log(`Validating all plugins in: ${targetPath}`);
    this.log("");

    try {
      const result = await validateAllPlugins(targetPath);

      const summary = result.valid
        ? `Done: ${result.summary.valid}/${result.summary.total} plugins valid`
        : `Done: ${result.summary.invalid} invalid plugins`;

      this.log(summary);

      this.log("");
      this.log("  Plugin Validation Summary:");
      this.log("  -------------------------");
      this.log(`  Total plugins: ${result.summary.total}`);
      this.log(`  Valid: ${result.summary.valid}`);
      this.log(`  Invalid: ${result.summary.invalid}`);
      this.log(`  With warnings: ${result.summary.withWarnings}`);

      for (const { name, result: pluginResult } of result.results) {
        printPluginValidationResult(name, pluginResult, verbose);
      }

      if (result.valid) {
        this.log("");
        this.logSuccess("All plugins validated successfully");
        this.log("");
      } else {
        this.log("");
        this.error("Validation failed", { exit: EXIT_CODES.ERROR });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.error(`Validation failed: ${message}`, { exit: EXIT_CODES.ERROR });
    }
  }

  private async validateSinglePlugin(
    targetPath: string,
    verbose: boolean,
  ): Promise<void> {
    this.log("");
    this.log(`Validating plugin: ${targetPath}`);
    this.log("");

    try {
      const result = await validatePlugin(targetPath);

      const summary = result.valid
        ? "Done: Plugin is valid"
        : "Done: Plugin has errors";

      this.log(summary);

      printPluginValidationResult(path.basename(targetPath), result, true);

      if (result.valid && result.warnings.length === 0) {
        this.log("");
        this.logSuccess("Plugin validated successfully");
        this.log("");
      } else if (result.valid) {
        this.log("");
        this.logWarning("Plugin valid with warnings");
        this.log("");
      } else {
        this.log("");
        this.error("Validation failed", { exit: EXIT_CODES.ERROR });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.error(`Validation failed: ${message}`, { exit: EXIT_CODES.ERROR });
    }
  }
}
