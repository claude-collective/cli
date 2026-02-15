// Logging utility for lib/ modules that don't have access to oclif command context.
// In oclif commands, prefer using this.log() instead.

let verboseMode = false;

export function setVerbose(enabled: boolean): void {
  verboseMode = enabled;
}

export function verbose(msg: string): void {
  if (verboseMode) {
    console.log(`  ${msg}`);
  }
}

// Always visible (not gated by verbose mode).
// Used for user-facing progress output: compilation ticks, summaries, validation results.
export function log(msg: string): void {
  console.log(msg);
}

// Always visible (not gated by verbose mode).
// Used for issues the user should know about, like unresolved references.
//
// Error/warning message style guide:
//   - Start with a capital letter (restructure if it would capitalize a function name)
//   - End with a period if it's a complete sentence
//   - End without a period if it's a fragment (e.g., "Skipping 'foo': missing SKILL.md")
//   - Wrap dynamic values in single quotes: 'value' (not bare or double-quoted)
//   - Do NOT prefix the message with "Warning:" — this function adds it automatically
//   - After a colon, use lowercase (e.g., "Skipping 'foo': invalid frontmatter")
//   - Use em dash for supplemental info (e.g., "Missing category — defaulting to 'local'")
export function warn(msg: string): void {
  console.warn(`  Warning: ${msg}`);
}
