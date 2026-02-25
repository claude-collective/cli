// Shared category definitions with domain overrides for test files.
// Uses createMockCategory from helpers.ts.

import { createMockCategory } from "../helpers.js";

// ---------------------------------------------------------------------------
// Categories from step-build.test.tsx (with domain overrides)
// ---------------------------------------------------------------------------

export const WEB_FRAMEWORK_CATEGORY = createMockCategory("web-framework", "Framework", {
  domain: "web",
  required: true,
  order: 0,
});

export const WEB_STYLING_CATEGORY = createMockCategory("web-styling", "Styling", {
  domain: "web",
  required: true,
  order: 1,
});

export const WEB_STATE_CATEGORY = createMockCategory("web-client-state", "Client State", {
  domain: "web",
  required: false,
  order: 2,
});

export const API_FRAMEWORK_CATEGORY = createMockCategory("api-api", "API Framework", {
  domain: "api",
  required: true,
  order: 0,
});

export const API_DATABASE_CATEGORY = createMockCategory("api-database", "Database", {
  domain: "api",
  required: false,
  order: 1,
});

// ---------------------------------------------------------------------------
// Categories from matrix-loader.test.ts (basic, no domain override)
// ---------------------------------------------------------------------------

export const FRAMEWORK_CATEGORY = createMockCategory("web-framework", "Framework", {
  description: "Web frameworks",
  exclusive: true,
  required: false,
  order: 1,
});
