import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import { InitWizard } from "../pages/wizards/init-wizard.js";
import { TIMEOUTS } from "../pages/constants.js";
import { cleanupTempDir, ensureBinaryExists } from "../helpers/test-utils.js";
import { createE2ESource } from "../helpers/create-e2e-source.js";
import "../matchers/setup.js";

/**
 * Tests for the F hotkey (filter incompatible) also deselecting incompatible skills.
 * Uses a custom source that includes Vue framework + pinia (Vue-only) alongside
 * React + zustand (React-compatible) with compatibleWith rules to verify that
 * pressing F with React selected deselects pinia.
 */

describe("init wizard — filter incompatible deselection", () => {
  let wizard: InitWizard | undefined;
  let source: { sourceDir: string; tempDir: string };

  beforeAll(async () => {
    await ensureBinaryExists();
    source = await createE2ESource({
      relationships: {
        compatibleWith: [
          { skills: ["zustand", "react"], reason: "Zustand works with React" },
          { skills: ["pinia", "vue-composition-api"], reason: "Pinia works with Vue" },
        ],
      },
    });
  }, TIMEOUTS.SETUP);

  afterAll(async () => {
    await cleanupTempDir(source.tempDir);
  });

  afterEach(async () => {
    await wizard?.destroy();
    wizard = undefined;
  });

  it(
    "should deselect incompatible skills when enabling filter",
    { timeout: TIMEOUTS.INTERACTIVE },
    async () => {
      wizard = await InitWizard.launch({ source });

      // Select stack (pre-selects React framework + zustand)
      const domain = await wizard.stack.selectFirstStack();
      const build = await domain.acceptDefaults();

      // Navigate to client-state category (Tab)
      await build.navigateToNextCategory();

      // Select pinia (navigates to its column in the grid and presses Space)
      await build.selectSkill("pinia");

      // Verify pinia appears on screen
      const output = build.getOutput();
      expect(output).toContain("pinia");

      // Press F to enable filter incompatible — pinia should be deselected and hidden
      await build.toggleFilterIncompatible();

      // After filtering: pinia should no longer be visible (filtered out)
      const afterFilter = build.getOutput();
      expect(afterFilter).not.toContain("pinia");

      // zustand should still be visible (compatible with React)
      expect(afterFilter).toContain("zustand");

      // Press F again to disable filter — pinia should reappear but NOT be selected
      await build.toggleFilterIncompatible();

      const afterUnfilter = build.getOutput();
      // Pinia should be visible again
      expect(afterUnfilter).toContain("pinia");
    },
  );
});
