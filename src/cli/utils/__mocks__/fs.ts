// Auto-mock for src/cli/utils/fs.ts.
// All functions return undefined by default; configure with vi.mocked() in beforeEach.
import { vi } from "vitest";

export const readFile = vi.fn();
export const readFileOptional = vi.fn();
export const writeFile = vi.fn();
export const ensureDir = vi.fn();
export const remove = vi.fn();
export const copy = vi.fn();
export const glob = vi.fn();
export const fileExists = vi.fn();
export const directoryExists = vi.fn();
export const listDirectories = vi.fn();
