import path from "path";
import { fileURLToPath } from "url";
import { run, Errors } from "@oclif/core";
import ansis from "ansis";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const CLI_ROOT = path.resolve(__dirname, "../../../../..");

/**
 * Run a CLI command and capture its output.
 *
 * Bun's `console.log` does not go through `process.stdout.write`, so
 * `@oclif/test`'s `runCommand` (which only intercepts `process.stdout.write`)
 * returns empty stdout/stderr in bun. This helper intercepts both layers
 * to work correctly in both Node.js and bun environments.
 */
export async function runCliCommand(args: string[]) {
  const origStdoutWrite = process.stdout.write;
  const origStderrWrite = process.stderr.write;
  const origLog = console.log;
  const origWarn = console.warn;
  const origError = console.error;

  const stdoutBuf: string[] = [];
  const stderrBuf: string[] = [];

  // Intercept process.stdout/stderr.write (Node.js path)
  process.stdout.write = function (str: unknown, encoding?: unknown, cb?: unknown): boolean {
    stdoutBuf.push(String(str));
    if (typeof encoding === "function") {
      (encoding as () => void)();
    } else if (typeof cb === "function") {
      (cb as () => void)();
    }
    return true;
  } as typeof process.stdout.write;

  process.stderr.write = function (str: unknown, encoding?: unknown, cb?: unknown): boolean {
    stderrBuf.push(String(str));
    if (typeof encoding === "function") {
      (encoding as () => void)();
    } else if (typeof cb === "function") {
      (cb as () => void)();
    }
    return true;
  } as typeof process.stderr.write;

  // Intercept console methods (bun path — console.log bypasses process.stdout.write)
  console.log = (...logArgs: unknown[]) => {
    stdoutBuf.push(logArgs.map(String).join(" ") + "\n");
  };
  console.warn = (...warnArgs: unknown[]) => {
    stderrBuf.push(warnArgs.map(String).join(" ") + "\n");
  };
  console.error = (...errArgs: unknown[]) => {
    stderrBuf.push(errArgs.map(String).join(" ") + "\n");
  };

  let error: (Error & Partial<Errors.CLIError>) | undefined;
  try {
    await run(args, { root: CLI_ROOT });
  } catch (e) {
    if (e instanceof Error) {
      error = Object.assign(e, { message: ansis.strip(e.message) }) as Error &
        Partial<Errors.CLIError>;
    }
  } finally {
    process.stdout.write = origStdoutWrite;
    process.stderr.write = origStderrWrite;
    console.log = origLog;
    console.warn = origWarn;
    console.error = origError;
  }

  return {
    stdout: stdoutBuf.map((s) => ansis.strip(s)).join(""),
    stderr: stderrBuf.map((s) => ansis.strip(s)).join(""),
    error,
  };
}
