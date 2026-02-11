/**
 * Base command class for all oclif commands in CLI v2.
 *
 * Provides:
 * - Shared flags (--dry-run, --source)
 * - Error handling with proper exit codes
 * - Common logging utilities
 * - Config access (set by init hook)
 */
import { Command, Flags } from "@oclif/core";
import { EXIT_CODES } from "./lib/exit-codes.js";
import type { ResolvedConfig } from "./lib/configuration/index.js";

export abstract class BaseCommand extends Command {
  /**
   * Base flags available to all commands.
   * Commands should merge these with their own flags using spread syntax.
   *
   * @example
   * static flags = {
   *   ...BaseCommand.baseFlags,
   *   myFlag: Flags.string({ description: "My custom flag" }),
   * };
   */
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

  /**
   * Loaded configuration - set by init hook and stored in config object.
   * Available after command initialization.
   */
  public get sourceConfig(): ResolvedConfig | undefined {
    return (this.config as any).sourceConfig;
  }

  /**
   * Handle errors with proper exit codes.
   * Logs the error message and exits the process.
   *
   * @param error - The error to handle
   * @returns Never returns (exits process)
   */
  protected handleError(error: unknown): never {
    const message = error instanceof Error ? error.message : String(error);
    this.error(message, { exit: EXIT_CODES.ERROR });
  }

  /**
   * Log a success message with a green checkmark.
   *
   * @param message - The success message to display
   */
  protected logSuccess(message: string): void {
    this.log(`✓ ${message}`);
  }

  /**
   * Log a warning message.
   * Uses oclif's warn method which outputs to stderr.
   *
   * @param message - The warning message to display
   */
  protected logWarning(message: string): void {
    this.warn(message);
  }

  /**
   * Log an informational message.
   *
   * @param message - The info message to display
   */
  protected logInfo(message: string): void {
    this.log(message);
  }
}
