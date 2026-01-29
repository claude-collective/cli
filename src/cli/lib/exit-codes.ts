/**
 * CLI exit codes for standardized process termination.
 *
 * These follow Unix conventions where 0 = success, non-zero = error.
 * Use named constants instead of magic numbers for clarity and consistency.
 */
export const EXIT_CODES = {
  /** Operation completed successfully */
  SUCCESS: 0,
  /** General error - operation failed */
  ERROR: 1,
  /** Invalid command-line arguments or options */
  INVALID_ARGS: 2,
  /** Network request failed (connection, timeout, etc.) */
  NETWORK_ERROR: 3,
  /** User cancelled the operation (Ctrl+C or prompt cancel) */
  CANCELLED: 4,
} as const;

export type ExitCode = (typeof EXIT_CODES)[keyof typeof EXIT_CODES];
