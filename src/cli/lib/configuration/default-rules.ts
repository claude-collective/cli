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
        skills: ["react", "vue-composition-api", "angular-standalone", "solidjs", "nextjs-app-router", "remix", "nuxt"],
        reason: "Frameworks are mutually exclusive",
      },
      {
        skills: ["pinia", "zustand", "redux-toolkit", "mobx"],
        reason: "Pinia is Vue-only; zustand/redux-toolkit/mobx skills teach React patterns",
      },
      {
        skills: ["ngrx-signalstore", "zustand", "pinia", "redux-toolkit", "mobx"],
        reason: "NgRx SignalStore is Angular-only",
      },
      {
        skills: ["react-query", "swr"],
        reason: "Both solve server state caching",
      },
      {
        skills: ["graphql-apollo", "graphql-urql"],
        reason: "Both are GraphQL clients",
      },
      {
        skills: ["playwright-e2e", "cypress-e2e"],
        reason: "Both are E2E frameworks",
      },
      {
        skills: ["react-hook-form", "vee-validate"],
        reason: "react-hook-form is React-only, vee-validate is Vue-only",
      },
      {
        skills: ["react-testing-library", "vue-test-utils"],
        reason: "Framework-specific testing libraries",
      },
      {
        skills: ["hono", "express", "fastify"],
        reason: "API frameworks are mutually exclusive within a single service",
      },
      {
        skills: ["drizzle", "prisma"],
        reason: "Both are ORMs serving similar purposes",
      },
      {
        skills: ["cli-commander", "oclif-ink"],
        reason: "CLI frameworks are mutually exclusive",
      },
    ],
    discourages: [
      {
        skills: ["zustand", "redux-toolkit", "mobx"],
        reason: "Using multiple React state libraries adds complexity",
      },
      {
        skills: ["redux-toolkit", "zustand"],
        reason: "Redux Toolkit adds more boilerplate than Zustand",
      },
      {
        skills: ["swr", "react-query"],
        reason: "SWR is simpler but React Query has more features",
      },
      {
        skills: ["express", "hono"],
        reason: "Express is mature but Hono offers better performance and edge support",
      },
      {
        skills: ["express", "fastify"],
        reason: "Express is mature but Fastify offers better performance",
      },
      {
        skills: ["cypress-e2e", "playwright-e2e"],
        reason:
          "Cypress excels at interactive debugging; Playwright has better cross-browser support and CI performance",
      },
    ],
    recommends: [
      { skill: "zustand", reason: "Best-in-class React state management" },
      { skill: "react-query", reason: "Modern server state caching for React" },
      { skill: "vitest", reason: "Fast, modern test runner for all frameworks" },
      { skill: "react-hook-form", reason: "Best React form library" },
      { skill: "react-testing-library", reason: "Standard React component testing" },
      { skill: "shadcn-ui", reason: "Best-in-class React + Tailwind component library" },
      { skill: "zod-validation", reason: "Type-safe validation for forms and APIs" },
      { skill: "pinia", reason: "Vue community standard state management" },
      { skill: "vee-validate", reason: "Vue community standard form validation" },
      { skill: "vue-test-utils", reason: "Vue component testing library" },
      { skill: "ngrx-signalstore", reason: "Angular Signals-based state management" },
      { skill: "tailwind", reason: "Utility-first CSS framework" },
      { skill: "drizzle", reason: "Modern TypeScript-first ORM" },
      { skill: "better-auth-drizzle-hono", reason: "Full-featured auth solution" },
      { skill: "radix-ui", reason: "Accessible unstyled component primitives" },
      { skill: "cva", reason: "Type-safe variant management for Tailwind" },
      { skill: "msw", reason: "Network-level API mocking for tests" },
      { skill: "playwright-e2e", reason: "Cross-browser E2E testing" },
      { skill: "posthog-analytics", reason: "Product analytics and feature flags" },
      { skill: "prisma", reason: "Mature database ORM with great DX" },
    ],
    requires: [
      {
        skill: "zustand",
        needs: ["react", "nextjs-app-router", "remix", "react-native"],
        needsAny: true,
        reason: "Our Zustand skill covers React/React Native patterns",
      },
      {
        skill: "redux-toolkit",
        needs: ["react", "nextjs-app-router", "remix", "react-native"],
        needsAny: true,
        reason: "Our Redux Toolkit skill covers React/React Native patterns",
      },
      {
        skill: "mobx",
        needs: ["react", "nextjs-app-router", "remix"],
        needsAny: true,
        reason: "Our MobX skill teaches React patterns",
      },
      {
        skill: "react-query",
        needs: ["react", "nextjs-app-router", "remix", "react-native"],
        needsAny: true,
        reason: "TanStack Query's React adapter",
      },
      {
        skill: "swr",
        needs: ["react", "nextjs-app-router", "remix", "react-native"],
        needsAny: true,
        reason: "SWR is a React Hooks library",
      },
      {
        skill: "react-hook-form",
        needs: ["react", "nextjs-app-router", "remix", "react-native"],
        needsAny: true,
        reason: "React Hook Form is React only",
      },
      {
        skill: "react-testing-library",
        needs: ["react", "nextjs-app-router", "remix"],
        needsAny: true,
        reason: "React Testing Library is React only",
      },
      {
        skill: "pinia",
        needs: ["vue-composition-api", "nuxt"],
        needsAny: true,
        reason: "Pinia is Vue only",
      },
      {
        skill: "vee-validate",
        needs: ["vue-composition-api", "nuxt"],
        needsAny: true,
        reason: "VeeValidate is Vue only",
      },
      {
        skill: "vue-test-utils",
        needs: ["vue-composition-api", "nuxt"],
        needsAny: true,
        reason: "Vue Test Utils is Vue only",
      },
      {
        skill: "ngrx-signalstore",
        needs: ["angular-standalone"],
        reason: "NgRx SignalStore is Angular only",
      },
      {
        skill: "better-auth-drizzle-hono",
        needs: ["drizzle", "prisma"],
        needsAny: true,
        reason: "Better Auth requires a database adapter",
      },
      {
        skill: "shadcn-ui",
        needs: ["react", "nextjs-app-router", "remix"],
        needsAny: true,
        reason: "shadcn/ui requires a React-based framework",
      },
      {
        skill: "shadcn-ui",
        needs: ["tailwind"],
        reason: "shadcn/ui requires Tailwind CSS",
      },
      {
        skill: "graphql-apollo",
        needs: ["react", "vue-composition-api", "angular-standalone", "nextjs-app-router", "remix", "nuxt"],
        needsAny: true,
        reason: "Apollo Client requires a UI framework",
      },
      {
        skill: "graphql-urql",
        needs: ["react", "vue-composition-api", "solidjs", "nextjs-app-router", "remix", "nuxt"],
        needsAny: true,
        reason: "URQL supports React, Vue, and Solid",
      },
    ],
    alternatives: [
      {
        purpose: "Frontend Framework",
        skills: ["react", "vue-composition-api", "angular-standalone", "solidjs", "nextjs-app-router", "remix", "nuxt"],
      },
      {
        purpose: "Styling",
        skills: ["scss-modules", "tailwind", "cva"],
      },
      {
        purpose: "Client State (React)",
        skills: ["zustand", "redux-toolkit", "mobx", "jotai"],
      },
      { purpose: "Client State (Vue)", skills: ["pinia"] },
      { purpose: "Client State (Angular)", skills: ["ngrx-signalstore"] },
      {
        purpose: "Server State / Data Fetching",
        skills: ["react-query", "swr"],
      },
      {
        purpose: "GraphQL Client",
        skills: ["graphql-apollo", "graphql-urql"],
      },
      {
        purpose: "API Framework",
        skills: ["hono", "express", "fastify"],
      },
      { purpose: "Database ORM", skills: ["drizzle", "prisma"] },
      { purpose: "Forms (React)", skills: ["react-hook-form"] },
      { purpose: "Forms (Vue)", skills: ["vee-validate"] },
      { purpose: "Validation", skills: ["zod-validation"] },
      { purpose: "Unit Testing", skills: ["vitest"] },
      { purpose: "Component Testing (React)", skills: ["react-testing-library"] },
      { purpose: "Component Testing (Vue)", skills: ["vue-test-utils"] },
      {
        purpose: "E2E Testing",
        skills: ["playwright-e2e", "cypress-e2e"],
      },
      { purpose: "API Mocking", skills: ["msw"] },
      { purpose: "UI Components (React + Tailwind)", skills: ["shadcn-ui"] },
      { purpose: "Mobile", skills: ["react-native"] },
      {
        purpose: "CLI Framework",
        skills: ["cli-commander", "oclif-ink"],
      },
    ],
  },
};
