import { describe, it, expect, beforeAll, afterEach } from "vitest";
import { expectPhaseSuccess } from "../assertions/phase-assertions.js";
import { E2E_AGENTS } from "../fixtures/expected-values.js";
import { InitWizard } from "../pages/wizards/init-wizard.js";
import { STEP_TEXT } from "../pages/constants.js";
import { ensureBinaryExists } from "../helpers/test-utils.js";
import "../matchers/setup.js";

describe("init wizard — stack flow", () => {
  let wizard: InitWizard | undefined;

  beforeAll(ensureBinaryExists);

  afterEach(async () => {
    await wizard?.destroy();
    wizard = undefined;
  });

  describe("stack selection happy path", () => {
    it("should display the wizard with stack options and scratch choice", async () => {
      wizard = await InitWizard.launch();

      const output = wizard.stack.getOutput();
      expect(output).toContain(STEP_TEXT.START_FROM_SCRATCH);
    });

    it("should show the E2E test stack from source config", async () => {
      wizard = await InitWizard.launch();

      const output = wizard.stack.getOutput();
      expect(output).toContain("E2E Test Stack");
      expect(output).toContain("Minimal stack for E2E testing");
    });

    it("should navigate stacks with arrow keys", async () => {
      wizard = await InitWizard.launch();

      await wizard.stack.navigateDown();

      const output = wizard.stack.getOutput();
      expect(output).toContain(STEP_TEXT.START_FROM_SCRATCH);
    });

    it("should select stack and advance to domain selection", async () => {
      wizard = await InitWizard.launch();

      const domain = await wizard.stack.selectFirstStack();

      const output = domain.getOutput();
      expect(output).toContain(STEP_TEXT.DOMAIN_WEB);
    });

    it("should complete a full stack-based init flow with defaults", async () => {
      wizard = await InitWizard.launch();
      const result = await wizard.completeWithDefaults();

      await expectPhaseSuccess(
        { project: result.project, exitCode: result.exitCode },
        {
          skillIds: ["web-framework-react"],
          agents: E2E_AGENTS.WEB_AND_API,
          source: "agents-inc",
          compiledAgents: E2E_AGENTS.WEB_AND_API,
        },
      );
      await expect(result.project).toHaveAgentFrontmatter("web-developer", {
        skills: ["web-framework-react"],
      });
    });

    it("should display completion details after install", async () => {
      wizard = await InitWizard.launch();
      const result = await wizard.completeWithDefaults();

      await result.exitCode;

      const output = result.output;
      expect(output).toContain(STEP_TEXT.AGENTS_COMPILED_TO);
      expect(output).toContain(STEP_TEXT.CONFIGURATION_LABEL);
    });

    describe("local install verification", () => {
      it("should copy skills to .claude/skills/ directory", async () => {
        wizard = await InitWizard.launch();
        const result = await wizard.completeWithDefaults();

        await expectPhaseSuccess(
          { project: result.project, exitCode: result.exitCode },
          { copiedSkills: ["web-framework-react"] },
        );
      });

      it("should not produce archive warnings during first install", async () => {
        wizard = await InitWizard.launch();
        const result = await wizard.completeWithDefaults();

        await result.exitCode;

        const output = result.output;
        expect(output).not.toContain("Failed to archive");
        expect(output).not.toContain("ENOENT");
      });

      it("should produce SkillConfig[] with id, scope, and source in config", async () => {
        wizard = await InitWizard.launch();
        const result = await wizard.completeWithDefaults();

        await result.exitCode;

        await expect(result.project).toHaveConfig({
          skillIds: ["web-framework-react"],
          agents: ["web-developer"],
          source: "agents-inc",
        });
      });

      it("should list copied skills in output", async () => {
        wizard = await InitWizard.launch();
        const result = await wizard.completeWithDefaults();

        await result.exitCode;

        const output = result.output;
        expect(output).toContain(STEP_TEXT.SKILLS_COPIED_TO);
        expect(output).toContain(".claude/skills");
      });
    });
  });

  describe("stack customize flow", () => {
    it("should show build step with stack skills when choosing customize", async () => {
      wizard = await InitWizard.launch();

      const domain = await wizard.stack.selectFirstStack();
      const build = await domain.acceptDefaults();

      const output = build.getOutput();
      expect(output).toContain(STEP_TEXT.BUILD);
    });
  });

  describe("stack skill restoration on domain re-toggle", () => {
    it("should restore stack skills when a domain is deselected and re-selected", async () => {
      wizard = await InitWizard.launch();

      // Select the E2E Test Stack
      const domain = await wizard.stack.selectFirstStack();

      // Deselect API domain then re-select it
      await domain.toggleDomain(STEP_TEXT.DOMAIN_API);
      await domain.toggleDomain(STEP_TEXT.DOMAIN_API);

      // Continue to build step
      const build = await domain.advance();

      // Advance through Web domain
      await build.advanceDomain();

      // The API domain should show restored stack skills
      const output = build.getOutput();
      expect(output).toContain("hono");
    });

    it("should not restore skills in scratch flow when domain is re-toggled", async () => {
      wizard = await InitWizard.launch();

      // Select "Start from scratch"
      const domain = await wizard.stack.selectScratch();

      // Deselect API then re-select it
      await domain.toggleDomain(STEP_TEXT.DOMAIN_API);
      await domain.toggleDomain(STEP_TEXT.DOMAIN_API);

      // Continue to build step
      const build = await domain.advance();

      // Select required skill in Web domain and advance
      await build.selectSkill("react");
      await build.advanceDomain();

      // In scratch flow, no stack snapshot exists — API domain should have 0 selected skills
      const output = build.getOutput();
      expect(output).toContain("(0 of 1)");
    });
  });
});
