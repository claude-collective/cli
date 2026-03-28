import path from "path";
import { writeFile } from "fs/promises";
import { describe, it, expect, beforeAll, afterEach } from "vitest";
import {
  createTempDir,
  cleanupTempDir,
  ensureBinaryExists,
  directoryExists,
  fileExists,
  getEjectedTemplatePath,
  listFiles,
  readTestFile,
} from "../helpers/test-utils.js";
import { ProjectBuilder } from "../fixtures/project-builder.js";
import { DIRS, EXIT_CODES, FILES } from "../pages/constants.js";
import { CLI } from "../fixtures/cli.js";

function agentsPath(projectDir: string): string {
  return path.join(projectDir, DIRS.CLAUDE, "agents");
}

/**
 * Eject command integration tests.
 *
 * These tests verify that ejected content integrates correctly with the
 * compilation pipeline. The existing eject.e2e.test.ts tests verify that
 * eject creates files; these tests verify the files are *usable*.
 *
 * Gap 7 from e2e-test-gaps.md: Eject Integration
 */

describe("eject command integration", () => {
  let tempDir: string | undefined;

  beforeAll(ensureBinaryExists);

  afterEach(async () => {
    if (tempDir) {
      await cleanupTempDir(tempDir);
      tempDir = undefined;
    }
  });

  it("ejected template path matches Liquid engine resolution", async () => {
    tempDir = await createTempDir();

    // Eject templates to the default location
    const { exitCode, stdout } = await CLI.run(["eject", "templates"], { dir: tempDir });

    expect(exitCode).toBe(EXIT_CODES.SUCCESS);
    expect(stdout).toContain("Eject complete!");

    // The exact path createLiquidEngine() checks at compiler.ts:414
    const templatePath = getEjectedTemplatePath(tempDir);
    expect(await fileExists(templatePath)).toBe(true);

    // Verify the file is non-empty and contains Liquid syntax
    const content = await readTestFile(templatePath);
    expect(content.length).toBeGreaterThan(0);
    expect(content).toMatch(/\{\{|\{%/);
  });

  it("ejected agent-partials structure matches readAgentFiles expectations", async () => {
    tempDir = await createTempDir();

    const { exitCode } = await CLI.run(["eject", "agent-partials"], { dir: tempDir });

    expect(exitCode).toBe(EXIT_CODES.SUCCESS);

    // The path loadProjectAgents() scans: .claude-src/agents/
    const agentsDir = path.join(tempDir, DIRS.CLAUDE_SRC, "agents");
    expect(await directoryExists(agentsDir)).toBe(true);

    // Find an agent directory (agent-partials ejects from src/agents/ which
    // contains subdirectories like developer/web-developer/)
    const topDirs = await listFiles(agentsDir);

    // Filter out _templates — we want agent directories only
    const agentGroupDirs = topDirs.filter((d) => !d.startsWith("_"));
    expect(agentGroupDirs.length).toBeGreaterThan(0);

    // Find a concrete agent directory (e.g., developer/web-developer)
    let foundAgent = false;
    for (const groupDir of agentGroupDirs) {
      const groupPath = path.join(agentsDir, groupDir);
      const subdirs = await listFiles(groupPath);

      for (const subdir of subdirs) {
        const agentPath = path.join(groupPath, subdir);

        const hasIdentity = await fileExists(path.join(agentPath, FILES.IDENTITY_MD));
        const hasPlaybook = await fileExists(path.join(agentPath, FILES.PLAYBOOK_MD));
        const hasMetadata = await fileExists(path.join(agentPath, FILES.METADATA_YAML));

        if (hasIdentity && hasPlaybook && hasMetadata) {
          foundAgent = true;

          // Verify the files are non-empty (readAgentFiles expects content)
          const identity = await readTestFile(path.join(agentPath, FILES.IDENTITY_MD));
          expect(identity.length).toBeGreaterThan(0);

          const playbook = await readTestFile(path.join(agentPath, FILES.PLAYBOOK_MD));
          expect(playbook.length).toBeGreaterThan(0);
          break;
        }
      }

      if (foundAgent) break;
    }

    expect(foundAgent).toBe(true);
  });

  it("eject templates -> modify -> compile picks up modified template", async () => {
    const project = await ProjectBuilder.minimal();
    tempDir = path.dirname(project.dir);
    const projectDir = project.dir;
    const agentsDir = agentsPath(project.dir);

    // Step 1: Eject templates
    const ejectResult = await CLI.run(["eject", "templates"], { dir: projectDir });
    expect(ejectResult.exitCode).toBe(EXIT_CODES.SUCCESS);

    // Step 2: Modify agent.liquid with a unique marker
    const templatePath = getEjectedTemplatePath(projectDir);
    expect(await fileExists(templatePath)).toBe(true);

    const originalTemplate = await readTestFile(templatePath);
    const marker = "<!-- E2E-EJECT-INTEGRATION-MARKER -->";
    const modifiedTemplate = originalTemplate + "\n" + marker + "\n";
    await writeFile(templatePath, modifiedTemplate);

    // Step 3: Compile
    const compileResult = await CLI.run(["compile"], { dir: projectDir });
    expect(compileResult.exitCode).toBe(EXIT_CODES.SUCCESS);

    // Step 4: Verify compiled agents contain the marker
    expect(await directoryExists(agentsDir)).toBe(true);
    const agentFiles = await listFiles(agentsDir);
    const mdFiles = agentFiles.filter((f) => f.endsWith(".md"));
    expect(mdFiles.length).toBeGreaterThan(0);

    for (const mdFile of mdFiles) {
      const agentContent = await readTestFile(path.join(agentsDir, mdFile));
      expect(agentContent).toContain(marker);
    }
  });

  it("eject without --force preserves existing customizations", async () => {
    tempDir = await createTempDir();

    // First eject
    const firstResult = await CLI.run(["eject", "templates"], { dir: tempDir });
    expect(firstResult.exitCode).toBe(EXIT_CODES.SUCCESS);

    // Modify the template with custom content
    const templatePath = getEjectedTemplatePath(tempDir);
    const customContent = "CUSTOM-USER-TEMPLATE-CONTENT-PRESERVED";
    await writeFile(templatePath, customContent);

    // Second eject WITHOUT --force
    const secondResult = await CLI.run(["eject", "templates"], { dir: tempDir });
    expect(secondResult.exitCode).toBe(EXIT_CODES.SUCCESS);
    // Should warn about existing templates
    expect(secondResult.output).toContain("already exist");

    // Custom content should be preserved (not overwritten)
    const afterContent = await readTestFile(templatePath);
    expect(afterContent).toBe(customContent);
  });

  it("eject with --force overwrites existing customizations", async () => {
    tempDir = await createTempDir();

    // First eject — get the original built-in content
    const firstResult = await CLI.run(["eject", "templates"], { dir: tempDir });
    expect(firstResult.exitCode).toBe(EXIT_CODES.SUCCESS);

    const templatePath = getEjectedTemplatePath(tempDir);
    const builtInContent = await readTestFile(templatePath);

    // Modify with custom content
    const customContent = "CUSTOM-USER-TEMPLATE-WILL-BE-OVERWRITTEN";
    await writeFile(templatePath, customContent);

    // Verify the custom content is there
    expect(await readTestFile(templatePath)).toBe(customContent);

    // Second eject WITH --force
    const forceResult = await CLI.run(["eject", "templates", "--force"], { dir: tempDir });
    expect(forceResult.exitCode).toBe(EXIT_CODES.SUCCESS);

    // Custom content should be overwritten with built-in content
    const afterForce = await readTestFile(templatePath);
    expect(afterForce).not.toContain(customContent);
    expect(afterForce).toBe(builtInContent);
  });
});
