/**
 * Shared test constants for CLI tests.
 *
 * Contains keyboard escape sequences and timing constants for ink-testing-library tests.
 */

// =============================================================================
// Keyboard Escape Sequences
// =============================================================================

/** Arrow Up key escape sequence */
export const ARROW_UP = "\x1B[A";

/** Arrow Down key escape sequence */
export const ARROW_DOWN = "\x1B[B";

/** Arrow Left key escape sequence */
export const ARROW_LEFT = "\x1B[D";

/** Arrow Right key escape sequence */
export const ARROW_RIGHT = "\x1B[C";

/** Enter key */
export const ENTER = "\r";

/** Escape key */
export const ESCAPE = "\x1B";

/** Ctrl+C key */
export const CTRL_C = "\x03";

/** Tab key */
export const TAB = "\t";

/** Backspace key */
export const BACKSPACE = "\x7F";

/** Letter Y for ConfirmInput */
export const KEY_Y = "y";

/** Letter N for ConfirmInput */
export const KEY_N = "n";

// =============================================================================
// Timing Constants
// =============================================================================

/** Delay after keyboard input to allow terminal to process (ms) */
export const INPUT_DELAY_MS = 50;

/** Delay for render/rerender operations (ms) */
export const RENDER_DELAY_MS = 100;

/** Delay for complex multi-step operations (ms) */
export const OPERATION_DELAY_MS = 150;

// =============================================================================
// Test Utilities
// =============================================================================

/**
 * Create a delay promise for async tests.
 *
 * @param ms - Milliseconds to wait
 * @returns Promise that resolves after the delay
 */
export const delay = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));
