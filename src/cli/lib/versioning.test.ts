import { describe, it, expect, beforeEach, afterEach } from "vitest";
import path from "path";
import os from "os";
import { mkdtemp, rm, mkdir, writeFile } from "fs/promises";
import {
  getCurrentDate,
  computeStringHash,
  computeFileHash,
  computeSkillFolderHash,
} from "./versioning";

describe("getCurrentDate", () => {
  it("should return date in YYYY-MM-DD format", () => {
    const result = getCurrentDate();
    // Match pattern YYYY-MM-DD
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("should return a valid date", () => {
    const result = getCurrentDate();
    const parsed = new Date(result);
    expect(parsed.toString()).not.toBe("Invalid Date");
  });

  it("should return today's date", () => {
    const result = getCurrentDate();
    const expected = new Date().toISOString().split("T")[0];
    expect(result).toBe(expected);
  });
});

describe("computeStringHash", () => {
  it("should return a 7-character hex string", () => {
    const result = computeStringHash("test content");
    expect(result).toMatch(/^[a-f0-9]{7}$/);
  });

  it("should return consistent hashes for the same content", () => {
    const content = "hello world";
    const hash1 = computeStringHash(content);
    const hash2 = computeStringHash(content);
    expect(hash1).toBe(hash2);
  });

  it("should return different hashes for different content", () => {
    const hash1 = computeStringHash("content A");
    const hash2 = computeStringHash("content B");
    expect(hash1).not.toBe(hash2);
  });

  it("when given empty string, should return valid 7-char hex hash", () => {
    const result = computeStringHash("");
    expect(result).toMatch(/^[a-f0-9]{7}$/);
  });

  it("should produce known hash for known input", () => {
    // SHA-256 of "test" is 9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08
    // First 7 chars: 9f86d08
    const result = computeStringHash("test");
    expect(result).toBe("9f86d08");
  });
});

describe("computeFileHash", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), "hashfile-test-"));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it("should hash file content", async () => {
    const filePath = path.join(tempDir, "test.txt");
    await writeFile(filePath, "test content");

    const hash = await computeFileHash(filePath);

    expect(hash).toMatch(/^[a-f0-9]{7}$/);
  });

  it("should return consistent hash for same file content", async () => {
    const filePath = path.join(tempDir, "test.txt");
    await writeFile(filePath, "hello world");

    const hash1 = await computeFileHash(filePath);
    const hash2 = await computeFileHash(filePath);

    expect(hash1).toBe(hash2);
  });

  it("should match computeStringHash for same content", async () => {
    const content = "matching content test";
    const filePath = path.join(tempDir, "test.txt");
    await writeFile(filePath, content);

    const fileHash = await computeFileHash(filePath);
    const stringHash = computeStringHash(content);

    expect(fileHash).toBe(stringHash);
  });
});

describe("computeSkillFolderHash", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), "versioning-test-"));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it("should hash SKILL.md content", async () => {
    await writeFile(path.join(tempDir, "SKILL.md"), "# Test Skill\n\nThis is a test.");

    const hash = await computeSkillFolderHash(tempDir);

    expect(hash).toMatch(/^[a-f0-9]{7}$/);
  });

  it("should return consistent hash for same content", async () => {
    await writeFile(path.join(tempDir, "SKILL.md"), "# Test Skill");

    const hash1 = await computeSkillFolderHash(tempDir);
    const hash2 = await computeSkillFolderHash(tempDir);

    expect(hash1).toBe(hash2);
  });

  it("should return different hash when content changes", async () => {
    await writeFile(path.join(tempDir, "SKILL.md"), "# Version 1");
    const hash1 = await computeSkillFolderHash(tempDir);

    await writeFile(path.join(tempDir, "SKILL.md"), "# Version 2");
    const hash2 = await computeSkillFolderHash(tempDir);

    expect(hash1).not.toBe(hash2);
  });

  it("should include reference.md in hash", async () => {
    await writeFile(path.join(tempDir, "SKILL.md"), "# Test");

    const hashWithoutRef = await computeSkillFolderHash(tempDir);

    await writeFile(path.join(tempDir, "reference.md"), "# Reference");
    const hashWithRef = await computeSkillFolderHash(tempDir);

    expect(hashWithoutRef).not.toBe(hashWithRef);
  });

  it("should include examples directory in hash", async () => {
    await writeFile(path.join(tempDir, "SKILL.md"), "# Test");

    const hashWithoutExamples = await computeSkillFolderHash(tempDir);

    await mkdir(path.join(tempDir, "examples"), { recursive: true });
    await writeFile(path.join(tempDir, "examples", "example.ts"), "// Example code");
    const hashWithExamples = await computeSkillFolderHash(tempDir);

    expect(hashWithoutExamples).not.toBe(hashWithExamples);
  });

  it("when skill folder has no files, should return valid hash from empty content", async () => {
    // No files in tempDir
    const hash = await computeSkillFolderHash(tempDir);

    // Should still return a valid hash (hash of empty content)
    expect(hash).toMatch(/^[a-f0-9]{7}$/);
  });
});
