import { execa } from "execa";
import { stripVTControlCharacters } from "node:util";
import type { ProjectHandle } from "../pages/wizard-result.js";
import { BIN_RUN } from "../helpers/test-utils.js";

export type CLIResult = {
  exitCode: number;
  stdout: string;
  stderr: string;
  /** Combined stdout + stderr, ANSI-stripped. */
  output: string;
};

export class CLI {
  /**
   * Run a non-interactive CLI command against a project.
   * HOME is set to project dir for isolation.
   */
  static async run(
    args: string[],
    project: ProjectHandle,
    options?: { env?: Record<string, string | undefined> },
  ): Promise<CLIResult> {
    const result = await execa("node", [BIN_RUN, ...args], {
      cwd: project.dir,
      reject: false,
      env: { HOME: project.dir, AGENTSINC_SOURCE: undefined, ...options?.env },
    });

    return {
      exitCode: result.exitCode ?? 1,
      stdout: stripVTControlCharacters(result.stdout),
      stderr: stripVTControlCharacters(result.stderr),
      output: stripVTControlCharacters(result.stdout + result.stderr),
    };
  }
}
