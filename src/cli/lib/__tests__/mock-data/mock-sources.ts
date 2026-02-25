// Shared SkillSource objects for test files.
// Uses createMockSkillSource from helpers.ts.

import { createMockSkillSource } from "../helpers.js";

// ---------------------------------------------------------------------------
// Sources from skill-resolution.integration.test.ts
// ---------------------------------------------------------------------------

export const PUBLIC_SOURCE = createMockSkillSource("public");

export const ACME_SOURCE = createMockSkillSource("private", {
  name: "acme-corp",
  url: "github:acme-corp/skills",
});

export const INTERNAL_SOURCE = createMockSkillSource("private", {
  name: "internal",
  url: "github:internal/skills",
});
