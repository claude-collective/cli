import { Command, Flags } from "@oclif/core";
import { EXIT_CODES } from "./lib/exit-codes.js";
import type { ResolvedConfig } from "./lib/configuration/index.js";

export abstract class BaseCommand extends Command {
  // Base flags available to all commands (merge with spread syntax)
  static baseFlags = {
    "dry-run": Flags.boolean({
      description: "Preview operations without executing",
      default: false,
    }),
    source: Flags.string({
      char: "s",
      description: "Skills source path or URL",
      required: false,
    }),
  };

  // Set by init hook, stored in config object
  public get sourceConfig(): ResolvedConfig | undefined {
    return (this.config as any).sourceConfig;
  }

  protected handleError(error: unknown): never {
    const message = error instanceof Error ? error.message : String(error);
    this.error(message, { exit: EXIT_CODES.ERROR });
  }

  protected logSuccess(message: string): void {
    this.log(`✓ ${message}`);
  }

  // Uses oclif's warn method which outputs to stderr
  protected logWarning(message: string): void {
    this.warn(message);
  }

  protected logInfo(message: string): void {
    this.log(message);
  }
}
