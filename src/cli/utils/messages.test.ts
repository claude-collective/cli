import { describe, it, expect } from "vitest";
import {
  ERROR_MESSAGES,
  SUCCESS_MESSAGES,
  STATUS_MESSAGES,
  INFO_MESSAGES,
  DRY_RUN_MESSAGES,
} from "./messages";

describe("ERROR_MESSAGES", () => {
  it("should have all expected keys", () => {
    expect(Object.keys(ERROR_MESSAGES)).toEqual([
      "UNKNOWN_ERROR",
      "UNKNOWN_ERROR_SHORT",
      "NO_INSTALLATION",
      "NO_LOCAL_SKILLS",
      "NO_SKILLS_FOUND",
      "VALIDATION_FAILED",
      "FAILED_RESOLVE_SOURCE",
      "FAILED_LOAD_AGENT_PARTIALS",
      "FAILED_COMPILE_AGENTS",
      "SKILL_NOT_FOUND",
    ]);
  });

  it("should have non-empty string values for every key", () => {
    for (const [key, value] of Object.entries(ERROR_MESSAGES)) {
      expect(value, `${key} should be a non-empty string`).toBeTruthy();
      expect(typeof value).toBe("string");
    }
  });
});

describe("SUCCESS_MESSAGES", () => {
  it("should have all expected keys", () => {
    expect(Object.keys(SUCCESS_MESSAGES)).toEqual([
      "IMPORT_COMPLETE",
      "UNINSTALL_COMPLETE",
      "INIT_SUCCESS",
      "PLUGIN_COMPILE_COMPLETE",
      "CUSTOM_COMPILE_COMPLETE",
      "ALL_SKILLS_UP_TO_DATE",
    ]);
  });

  it("should have non-empty string values for every key", () => {
    for (const [key, value] of Object.entries(SUCCESS_MESSAGES)) {
      expect(value, `${key} should be a non-empty string`).toBeTruthy();
      expect(typeof value).toBe("string");
    }
  });
});

describe("STATUS_MESSAGES", () => {
  it("should have all expected keys", () => {
    expect(Object.keys(STATUS_MESSAGES)).toEqual([
      "LOADING_SKILLS",
      "LOADING_MARKETPLACE_SOURCE",
      "RECOMPILING_AGENTS",
      "COMPILING_AGENTS",
      "DISCOVERING_SKILLS",
      "RESOLVING_SOURCE",
      "RESOLVING_MARKETPLACE_SOURCE",
      "FETCHING_AGENT_PARTIALS",
      "LOADING_AGENT_PARTIALS",
      "FETCHING_REPOSITORY",
      "COPYING_SKILLS",
      "UPDATING_PLUGIN_SKILLS",
    ]);
  });

  it("should have non-empty string values for every key", () => {
    for (const [key, value] of Object.entries(STATUS_MESSAGES)) {
      expect(value, `${key} should be a non-empty string`).toBeTruthy();
      expect(typeof value).toBe("string");
    }
  });

  it("should end with ellipsis for all loading/progress messages", () => {
    for (const [key, value] of Object.entries(STATUS_MESSAGES)) {
      expect(value, `${key} should end with '...'`).toMatch(/\.\.\.$/);
    }
  });
});

describe("INFO_MESSAGES", () => {
  it("should have all expected keys", () => {
    expect(Object.keys(INFO_MESSAGES)).toEqual([
      "NO_CHANGES_MADE",
      "RUN_COMPILE",
      "NO_AGENTS_TO_RECOMPILE",
      "NO_AGENTS_TO_COMPILE",
      "NO_PLUGIN_INSTALLATION",
      "NO_LOCAL_INSTALLATION",
      "NOT_INSTALLED",
    ]);
  });

  it("should have non-empty string values for every key", () => {
    for (const [key, value] of Object.entries(INFO_MESSAGES)) {
      expect(value, `${key} should be a non-empty string`).toBeTruthy();
      expect(typeof value).toBe("string");
    }
  });
});

describe("DRY_RUN_MESSAGES", () => {
  it("should have all expected keys", () => {
    expect(Object.keys(DRY_RUN_MESSAGES)).toEqual([
      "PREVIEW_NO_FILES_REMOVED",
      "PREVIEW_NO_FILES_CREATED",
      "COMPLETE_NO_FILES_REMOVED",
      "COMPLETE_NO_FILES_WRITTEN",
      "COMPLETE_NO_FILES_CREATED",
    ]);
  });

  it("should have non-empty string values for every key", () => {
    for (const [key, value] of Object.entries(DRY_RUN_MESSAGES)) {
      expect(value, `${key} should be a non-empty string`).toBeTruthy();
      expect(typeof value).toBe("string");
    }
  });

  it("should all start with [dry-run] prefix", () => {
    for (const [key, value] of Object.entries(DRY_RUN_MESSAGES)) {
      expect(value, `${key} should start with '[dry-run]'`).toMatch(/^\[dry-run\]/);
    }
  });

  it("should distinguish preview from complete messages", () => {
    expect(DRY_RUN_MESSAGES.PREVIEW_NO_FILES_REMOVED).toContain("Preview mode");
    expect(DRY_RUN_MESSAGES.PREVIEW_NO_FILES_CREATED).toContain("Preview mode");
    expect(DRY_RUN_MESSAGES.COMPLETE_NO_FILES_REMOVED).toContain("Preview complete");
    expect(DRY_RUN_MESSAGES.COMPLETE_NO_FILES_WRITTEN).toContain("Preview complete");
    expect(DRY_RUN_MESSAGES.COMPLETE_NO_FILES_CREATED).toContain("Preview complete");
  });
});
