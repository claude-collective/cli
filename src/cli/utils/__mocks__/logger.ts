/**
 * Manual mock for src/cli/utils/logger.ts.
 *
 * Used automatically when test files call vi.mock("../../utils/logger") without a factory.
 */
import { vi } from "vitest";

export const verbose = vi.fn();
export const warn = vi.fn();
export const setVerbose = vi.fn();
