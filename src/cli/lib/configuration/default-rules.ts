import type { SkillRulesConfig } from "../../types";

/**
 * Built-in skill rules, equivalent to config/skill-rules.ts.
 * Source repos may override or extend these via their own config files.
 */
export const defaultRules: SkillRulesConfig = {
  version: "1.0.0",
  relationships: {
    conflicts: [
      {
        skills: [
          "web-framework-react",
          "web-framework-vue-composition-api",
          "web-framework-angular-standalone",
          "web-framework-solidjs",
          "web-framework-nextjs-app-router",
          "web-framework-remix",
          "web-framework-nuxt",
        ],
        reason: "Frameworks are mutually exclusive",
      },
      {
        skills: [
          "web-state-pinia",
          "web-state-zustand",
          "web-state-redux-toolkit",
          "web-state-mobx",
        ],
        reason: "Pinia is Vue-only; zustand/redux-toolkit/mobx skills teach React patterns",
      },
      {
        skills: [
          "web-state-ngrx-signalstore",
          "web-state-zustand",
          "web-state-pinia",
          "web-state-redux-toolkit",
          "web-state-mobx",
        ],
        reason: "NgRx SignalStore is Angular-only",
      },
      {
        skills: ["web-server-state-react-query", "web-data-fetching-swr"],
        reason: "Both solve server state caching",
      },
      {
        skills: ["web-data-fetching-graphql-apollo", "web-data-fetching-graphql-urql"],
        reason: "Both are GraphQL clients",
      },
      {
        skills: ["web-testing-playwright-e2e", "web-testing-cypress-e2e"],
        reason: "Both are E2E frameworks",
      },
      {
        skills: ["web-forms-react-hook-form", "web-forms-vee-validate"],
        reason: "react-hook-form is React-only, vee-validate is Vue-only",
      },
      {
        skills: ["web-testing-react-testing-library", "web-testing-vue-test-utils"],
        reason: "Framework-specific testing libraries",
      },
      {
        skills: ["api-framework-hono", "api-framework-express", "api-framework-fastify"],
        reason: "API frameworks are mutually exclusive within a single service",
      },
      {
        skills: ["api-database-drizzle", "api-database-prisma"],
        reason: "Both are ORMs serving similar purposes",
      },
      {
        skills: ["cli-framework-cli-commander", "cli-framework-oclif-ink"],
        reason: "CLI frameworks are mutually exclusive",
      },
    ],
    discourages: [
      {
        skills: ["web-state-zustand", "web-state-redux-toolkit", "web-state-mobx"],
        reason: "Using multiple React state libraries adds complexity",
      },
      {
        skills: ["web-state-redux-toolkit", "web-state-zustand"],
        reason: "Redux Toolkit adds more boilerplate than Zustand",
      },
      {
        skills: ["web-data-fetching-swr", "web-server-state-react-query"],
        reason: "SWR is simpler but React Query has more features",
      },
      {
        skills: ["api-framework-express", "api-framework-hono"],
        reason: "Express is mature but Hono offers better performance and edge support",
      },
      {
        skills: ["api-framework-express", "api-framework-fastify"],
        reason: "Express is mature but Fastify offers better performance",
      },
      {
        skills: ["web-testing-cypress-e2e", "web-testing-playwright-e2e"],
        reason:
          "Cypress excels at interactive debugging; Playwright has better cross-browser support and CI performance",
      },
    ],
    recommends: [
      { skill: "web-state-zustand", reason: "Best-in-class React state management" },
      { skill: "web-server-state-react-query", reason: "Modern server state caching for React" },
      { skill: "web-testing-vitest", reason: "Fast, modern test runner for all frameworks" },
      { skill: "web-forms-react-hook-form", reason: "Best React form library" },
      { skill: "web-testing-react-testing-library", reason: "Standard React component testing" },
      { skill: "web-ui-shadcn-ui", reason: "Best-in-class React + Tailwind component library" },
      { skill: "web-forms-zod-validation", reason: "Type-safe validation for forms and APIs" },
      { skill: "web-state-pinia", reason: "Vue community standard state management" },
      { skill: "web-forms-vee-validate", reason: "Vue community standard form validation" },
      { skill: "web-testing-vue-test-utils", reason: "Vue component testing library" },
      { skill: "web-state-ngrx-signalstore", reason: "Angular Signals-based state management" },
      { skill: "web-styling-tailwind", reason: "Utility-first CSS framework" },
      { skill: "api-database-drizzle", reason: "Modern TypeScript-first ORM" },
      { skill: "api-auth-better-auth-drizzle-hono", reason: "Full-featured auth solution" },
      { skill: "web-ui-radix-ui", reason: "Accessible unstyled component primitives" },
      { skill: "web-styling-cva", reason: "Type-safe variant management for Tailwind" },
      { skill: "web-mocks-msw", reason: "Network-level API mocking for tests" },
      { skill: "web-testing-playwright-e2e", reason: "Cross-browser E2E testing" },
      { skill: "api-analytics-posthog-analytics", reason: "Product analytics and feature flags" },
      { skill: "api-database-prisma", reason: "Mature database ORM with great DX" },
    ],
    requires: [
      {
        skill: "web-state-zustand",
        needs: [
          "web-framework-react",
          "web-framework-nextjs-app-router",
          "web-framework-remix",
          "mobile-framework-react-native",
        ],
        needsAny: true,
        reason: "Our Zustand skill covers React/React Native patterns",
      },
      {
        skill: "web-state-redux-toolkit",
        needs: [
          "web-framework-react",
          "web-framework-nextjs-app-router",
          "web-framework-remix",
          "mobile-framework-react-native",
        ],
        needsAny: true,
        reason: "Our Redux Toolkit skill covers React/React Native patterns",
      },
      {
        skill: "web-state-mobx",
        needs: ["web-framework-react", "web-framework-nextjs-app-router", "web-framework-remix"],
        needsAny: true,
        reason: "Our MobX skill teaches React patterns",
      },
      {
        skill: "web-server-state-react-query",
        needs: [
          "web-framework-react",
          "web-framework-nextjs-app-router",
          "web-framework-remix",
          "mobile-framework-react-native",
        ],
        needsAny: true,
        reason: "TanStack Query's React adapter",
      },
      {
        skill: "web-data-fetching-swr",
        needs: [
          "web-framework-react",
          "web-framework-nextjs-app-router",
          "web-framework-remix",
          "mobile-framework-react-native",
        ],
        needsAny: true,
        reason: "SWR is a React Hooks library",
      },
      {
        skill: "web-forms-react-hook-form",
        needs: [
          "web-framework-react",
          "web-framework-nextjs-app-router",
          "web-framework-remix",
          "mobile-framework-react-native",
        ],
        needsAny: true,
        reason: "React Hook Form is React only",
      },
      {
        skill: "web-testing-react-testing-library",
        needs: ["web-framework-react", "web-framework-nextjs-app-router", "web-framework-remix"],
        needsAny: true,
        reason: "React Testing Library is React only",
      },
      {
        skill: "web-state-pinia",
        needs: ["web-framework-vue-composition-api", "web-framework-nuxt"],
        needsAny: true,
        reason: "Pinia is Vue only",
      },
      {
        skill: "web-forms-vee-validate",
        needs: ["web-framework-vue-composition-api", "web-framework-nuxt"],
        needsAny: true,
        reason: "VeeValidate is Vue only",
      },
      {
        skill: "web-testing-vue-test-utils",
        needs: ["web-framework-vue-composition-api", "web-framework-nuxt"],
        needsAny: true,
        reason: "Vue Test Utils is Vue only",
      },
      {
        skill: "web-state-ngrx-signalstore",
        needs: ["web-framework-angular-standalone"],
        reason: "NgRx SignalStore is Angular only",
      },
      {
        skill: "api-auth-better-auth-drizzle-hono",
        needs: ["api-database-drizzle", "api-database-prisma"],
        needsAny: true,
        reason: "Better Auth requires a database adapter",
      },
      {
        skill: "web-ui-shadcn-ui",
        needs: ["web-framework-react", "web-framework-nextjs-app-router", "web-framework-remix"],
        needsAny: true,
        reason: "shadcn/ui requires a React-based framework",
      },
      {
        skill: "web-ui-shadcn-ui",
        needs: ["web-styling-tailwind"],
        reason: "shadcn/ui requires Tailwind CSS",
      },
      {
        skill: "web-data-fetching-graphql-apollo",
        needs: [
          "web-framework-react",
          "web-framework-vue-composition-api",
          "web-framework-angular-standalone",
          "web-framework-nextjs-app-router",
          "web-framework-remix",
          "web-framework-nuxt",
        ],
        needsAny: true,
        reason: "Apollo Client requires a UI framework",
      },
      {
        skill: "web-data-fetching-graphql-urql",
        needs: [
          "web-framework-react",
          "web-framework-vue-composition-api",
          "web-framework-solidjs",
          "web-framework-nextjs-app-router",
          "web-framework-remix",
          "web-framework-nuxt",
        ],
        needsAny: true,
        reason: "URQL supports React, Vue, and Solid",
      },
    ],
    alternatives: [
      {
        purpose: "Frontend Framework",
        skills: [
          "web-framework-react",
          "web-framework-vue-composition-api",
          "web-framework-angular-standalone",
          "web-framework-solidjs",
          "web-framework-nextjs-app-router",
          "web-framework-remix",
          "web-framework-nuxt",
        ],
      },
      {
        purpose: "Styling",
        skills: ["web-styling-scss-modules", "web-styling-tailwind", "web-styling-cva"],
      },
      {
        purpose: "Client State (React)",
        skills: [
          "web-state-zustand",
          "web-state-redux-toolkit",
          "web-state-mobx",
          "web-state-jotai",
        ],
      },
      { purpose: "Client State (Vue)", skills: ["web-state-pinia"] },
      { purpose: "Client State (Angular)", skills: ["web-state-ngrx-signalstore"] },
      {
        purpose: "Server State / Data Fetching",
        skills: ["web-server-state-react-query", "web-data-fetching-swr"],
      },
      {
        purpose: "GraphQL Client",
        skills: ["web-data-fetching-graphql-apollo", "web-data-fetching-graphql-urql"],
      },
      {
        purpose: "API Framework",
        skills: ["api-framework-hono", "api-framework-express", "api-framework-fastify"],
      },
      { purpose: "Database ORM", skills: ["api-database-drizzle", "api-database-prisma"] },
      { purpose: "Forms (React)", skills: ["web-forms-react-hook-form"] },
      { purpose: "Forms (Vue)", skills: ["web-forms-vee-validate"] },
      { purpose: "Validation", skills: ["web-forms-zod-validation"] },
      { purpose: "Unit Testing", skills: ["web-testing-vitest"] },
      { purpose: "Component Testing (React)", skills: ["web-testing-react-testing-library"] },
      { purpose: "Component Testing (Vue)", skills: ["web-testing-vue-test-utils"] },
      {
        purpose: "E2E Testing",
        skills: ["web-testing-playwright-e2e", "web-testing-cypress-e2e"],
      },
      { purpose: "API Mocking", skills: ["web-mocks-msw"] },
      { purpose: "UI Components (React + Tailwind)", skills: ["web-ui-shadcn-ui"] },
      { purpose: "Mobile", skills: ["mobile-framework-react-native"] },
      {
        purpose: "CLI Framework",
        skills: ["cli-framework-cli-commander", "cli-framework-oclif-ink"],
      },
    ],
  },
};
