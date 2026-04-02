import { Command, Flags } from "@oclif/core";

import chalk from "chalk";

import { CLI_COLORS } from "./consts.js";
import { getErrorMessage } from "./utils/errors.js";
import { EXIT_CODES } from "./lib/exit-codes.js";
import type { ResolvedConfig } from "./lib/configuration/index.js";

/** Narrow interface for the sourceConfig we attach to oclif's Config in the init hook. */
export interface ConfigWithSource {
  sourceConfig?: ResolvedConfig;
}

export abstract class BaseCommand extends Command {
  static baseFlags = {
    source: Flags.string({
      char: "s",
      description: "Skills source path or URL",
      required: false,
    }),
  };

  async init(): Promise<void> {
    await super.init();
    await this.ensureTerminalSize();
  }

  public get sourceConfig(): ResolvedConfig | undefined {
    // Boundary cast: oclif Config is a class (not augmentable); we attach sourceConfig in the init hook
    return (this.config as unknown as ConfigWithSource).sourceConfig;
  }

  protected async ensureTerminalSize(): Promise<void> {
    const MIN_WIDTH = 80;
    const MIN_HEIGHT = 15;

    const isValid = () => {
      const cols = process.stdout.columns ?? MIN_WIDTH;
      const rows = process.stdout.rows ?? MIN_HEIGHT;
      return cols >= MIN_WIDTH && rows >= MIN_HEIGHT;
    };

    if (isValid()) return;

    const cols = process.stdout.columns ?? MIN_WIDTH;
    const rows = process.stdout.rows ?? MIN_HEIGHT;
    const issue =
      cols < MIN_WIDTH ? `too narrow (need ${MIN_WIDTH})` : `too short (need ${MIN_HEIGHT})`;

    this.clearTerminal();
    this.log(chalk.hex(CLI_COLORS.WARNING)(`Terminal ${issue}. Please resize.`));

    await new Promise<void>((resolve) => {
      const check = () => {
        if (isValid()) {
          clearInterval(interval);
          process.stdout.off("resize", check);
          resolve();
        }
      };
      const interval = setInterval(check, 500);
      process.stdout.on("resize", check);
    });
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

  protected clearTerminal(): void {
    process.stdout.write("\x1b[H\x1b[2J\x1b[3J");
  }
}
