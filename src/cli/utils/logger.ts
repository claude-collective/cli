/**
 * Verbose logging utility.
 * Used by lib/ modules that don't have access to oclif command context.
 * In oclif commands, prefer using this.log() instead.
 */

let verboseMode = false;

export function setVerbose(enabled: boolean): void {
  verboseMode = enabled;
}

export function verbose(msg: string): void {
  if (verboseMode) {
    console.log(`  ${msg}`);
  }
}

/**
 * Log a warning that is always visible (not gated by verbose mode).
 * Used for issues the user should know about, like unresolved references.
 */
export function warn(msg: string): void {
  console.warn(`  Warning: ${msg}`);
}
