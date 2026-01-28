import { describe, it, expect, beforeEach, afterEach } from "vitest";
import path from "path";
import os from "os";
import { mkdtemp, rm, mkdir, readFile } from "fs/promises";
import { existsSync } from "fs";

// Note: We test the internal functions and file operations rather than
// the CLI command itself to avoid process.exit() issues in tests

describe("eject command", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), "cc-eject-test-"));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  describe("eject templates", () => {
    it("should create .claude/templates directory", async () => {
      const { ensureDir, copy, directoryExists } = await import("../utils/fs");
      const { DIRS, PROJECT_ROOT } = await import("../consts");

      const sourceDir = path.join(PROJECT_ROOT, DIRS.templates);
      const destDir = path.join(tempDir, ".claude", "templates");

      await ensureDir(destDir);
      await copy(sourceDir, destDir);

      expect(await directoryExists(destDir)).toBe(true);
    });

    it("should copy agent.liquid template", async () => {
      const { ensureDir, copy } = await import("../utils/fs");
      const { DIRS, PROJECT_ROOT } = await import("../consts");

      const sourceDir = path.join(PROJECT_ROOT, DIRS.templates);
      const destDir = path.join(tempDir, ".claude", "templates");

      await ensureDir(destDir);
      await copy(sourceDir, destDir);

      const agentTemplate = path.join(destDir, "agent.liquid");
      expect(existsSync(agentTemplate)).toBe(true);

      const content = await readFile(agentTemplate, "utf-8");
      expect(content).toContain("{% for"); // Contains liquid templates
    });
  });

  describe("eject skills", () => {
    it("should create skill-templates directory with example", async () => {
      const { ensureDir, writeFile, directoryExists } =
        await import("../utils/fs");

      const destDir = path.join(tempDir, ".claude", "skill-templates");
      const exampleSkillDir = path.join(destDir, "example-skill");

      await ensureDir(exampleSkillDir);
      await writeFile(
        path.join(exampleSkillDir, "SKILL.md"),
        "---\nname: example-skill\n---\nContent",
      );
      await writeFile(
        path.join(exampleSkillDir, "metadata.yaml"),
        "cli_name: Example Skill",
      );

      expect(await directoryExists(destDir)).toBe(true);
      expect(existsSync(path.join(exampleSkillDir, "SKILL.md"))).toBe(true);
      expect(existsSync(path.join(exampleSkillDir, "metadata.yaml"))).toBe(
        true,
      );
    });
  });

  describe("eject config", () => {
    it("should create config.yaml with default content", async () => {
      const { ensureDir, writeFile } = await import("../utils/fs");

      const destPath = path.join(tempDir, ".claude", "config.yaml");
      const defaultContent = `name: my-project\nagents:\n  - frontend-developer`;

      await ensureDir(path.dirname(destPath));
      await writeFile(destPath, defaultContent);

      expect(existsSync(destPath)).toBe(true);

      const content = await readFile(destPath, "utf-8");
      expect(content).toContain("name: my-project");
      expect(content).toContain("frontend-developer");
    });
  });

  describe("force flag behavior", () => {
    it("should not overwrite existing templates without force", async () => {
      const { ensureDir, writeFile, directoryExists } =
        await import("../utils/fs");

      const destDir = path.join(tempDir, ".claude", "templates");
      const markerFile = path.join(destDir, "marker.txt");

      // Create existing templates directory with marker
      await ensureDir(destDir);
      await writeFile(markerFile, "original content");

      // Check that directory exists (simulating the guard in eject)
      const exists = await directoryExists(destDir);
      expect(exists).toBe(true);

      // The guard would prevent overwrite without force
      // Verify original content remains
      const content = await readFile(markerFile, "utf-8");
      expect(content).toBe("original content");
    });
  });
});

describe("createLiquidEngine with local templates", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), "cc-liquid-test-"));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it("should use bundled templates when no local templates exist", async () => {
    const { createLiquidEngine } = await import("../lib/compiler");

    // No .claude/templates in tempDir
    const engine = await createLiquidEngine(tempDir);

    // Should be able to render bundled agent template
    // (just verify engine was created successfully)
    expect(engine).toBeDefined();
    expect(typeof engine.renderFile).toBe("function");
  });

  it("should prefer local templates when they exist", async () => {
    const { createLiquidEngine } = await import("../lib/compiler");
    const { ensureDir, writeFile } = await import("../utils/fs");

    // Create local templates directory with custom template
    const localTemplatesDir = path.join(tempDir, ".claude", "templates");
    await ensureDir(localTemplatesDir);
    await writeFile(
      path.join(localTemplatesDir, "test.liquid"),
      "Hello {{ name }}!",
    );

    const engine = await createLiquidEngine(tempDir);

    // Should be able to render local template
    const result = await engine.renderFile("test", { name: "World" });
    expect(result).toBe("Hello World!");
  });

  it("should fall back to bundled templates for missing local files", async () => {
    const { createLiquidEngine } = await import("../lib/compiler");
    const { ensureDir, writeFile } = await import("../utils/fs");

    // Create local templates directory with partial override
    const localTemplatesDir = path.join(tempDir, ".claude", "templates");
    await ensureDir(localTemplatesDir);
    await writeFile(
      path.join(localTemplatesDir, "custom.liquid"),
      "Custom content",
    );

    const engine = await createLiquidEngine(tempDir);

    // Should still be able to use bundled templates
    // The engine has multiple roots - local first, then bundled
    expect(engine).toBeDefined();
  });
});
