// E2E source skills (from create-e2e-source.ts)
export const E2E_SKILL_IDS = [
  "api-framework-hono",
  "meta-methodology-research-methodology",
  "meta-reviewing-cli-reviewing",
  "meta-reviewing-reviewing",
  "web-framework-react",
  "web-framework-vue-composition-api",
  "web-state-pinia",
  "web-state-zustand",
  "web-testing-vitest",
] as const;

// Derive from E2E source agent definitions (create-e2e-source.ts)
export const E2E_AGENTS = {
  WEB: ["web-developer"],
  API: ["api-developer"],
  get WEB_AND_API() {
    return [...this.API, ...this.WEB].sort();
  },
} as const;
