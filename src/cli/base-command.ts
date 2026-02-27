import { Command, Flags } from "@oclif/core";
import { getErrorMessage } from "./utils/errors.js";
import { EXIT_CODES } from "./lib/exit-codes.js";
import type { ResolvedConfig } from "./lib/configuration/index.js";

/** Narrow interface for the sourceConfig we attach to oclif's Config in the init hook. */
export interface ConfigWithSource {
  sourceConfig?: ResolvedConfig;
}

export abstract class BaseCommand extends Command {
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

  public get sourceConfig(): ResolvedConfig | undefined {
    // Boundary cast: oclif Config doesn't declare sourceConfig; we attach it in the init hook
    return (this.config as unknown as ConfigWithSource).sourceConfig;
  }

  protected handleError(error: unknown): never {
    const message = getErrorMessage(error);
    this.error(message, { exit: EXIT_CODES.ERROR });
  }

  protected logSuccess(message: string): void {
    this.log(`✓ ${message}`);
  }

  protected logWarning(message: string): void {
    this.warn(message);
  }

  protected logInfo(message: string): void {
    this.log(message);
  }
}
