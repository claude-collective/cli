// Shared category definitions with domain overrides for test files.
// Spreads from TEST_CATEGORIES in test-fixtures.ts.

import { TEST_CATEGORIES } from "../test-fixtures.js";

// ---------------------------------------------------------------------------
// Categories from step-build.test.tsx (with domain overrides)
// ---------------------------------------------------------------------------

export const WEB_FRAMEWORK_CATEGORY = {
  ...TEST_CATEGORIES.framework,
  required: true,
};

export const WEB_STYLING_CATEGORY = {
  ...TEST_CATEGORIES.styling,
  required: true,
  order: 1,
};

export const WEB_STATE_CATEGORY = {
  ...TEST_CATEGORIES.clientState,
  order: 2,
};

export const API_FRAMEWORK_CATEGORY = {
  ...TEST_CATEGORIES.api,
  displayName: "API Framework",
  // Boundary cast: narrows string to Domain union
  domain: "api" as const,
  required: true,
  order: 0,
};

export const API_DATABASE_CATEGORY = {
  ...TEST_CATEGORIES.database,
  // Boundary cast: narrows string to Domain union
  domain: "api" as const,
  order: 1,
};

// ---------------------------------------------------------------------------
// Categories from matrix-loader.test.ts (basic, no domain override)
// ---------------------------------------------------------------------------

export const CLI_FRAMEWORK_CATEGORY = {
  ...TEST_CATEGORIES.cliFramework,
  domain: "cli" as const,
  exclusive: false,
};

export const FRAMEWORK_CATEGORY = {
  ...TEST_CATEGORIES.framework,
  description: "Web frameworks",
  order: 1,
};
