import type { SkillRulesConfig } from "../../types";

/**
 * Built-in skill rules, equivalent to config/skill-rules.ts.
 * Source repos may override or extend these via their own config files.
 */
export const defaultRules: SkillRulesConfig = {
  version: "1.0.0",
  aliases: {
    // Frameworks
    react: "web-framework-react",
    vue: "web-framework-vue-composition-api",
    angular: "web-framework-angular-standalone",
    solidjs: "web-framework-solidjs",
    "nextjs-app-router": "web-framework-nextjs-app-router",
    "nextjs-server-actions": "web-framework-nextjs-server-actions",
    remix: "web-framework-remix",
    nuxt: "web-framework-nuxt",

    // Styling
    "scss-modules": "web-styling-scss-modules",
    cva: "web-styling-cva",
    tailwind: "web-styling-tailwind",

    // Client State
    zustand: "web-state-zustand",
    "redux-toolkit": "web-state-redux-toolkit",
    pinia: "web-state-pinia",
    "ngrx-signalstore": "web-state-ngrx-signalstore",
    jotai: "web-state-jotai",
    mobx: "web-state-mobx",

    // Server State
    "react-query": "web-server-state-react-query",
    swr: "web-data-fetching-swr",
    "graphql-apollo": "web-data-fetching-graphql-apollo",
    "graphql-urql": "web-data-fetching-graphql-urql",
    trpc: "web-data-fetching-trpc",

    // Forms
    "react-hook-form": "web-forms-react-hook-form",
    "vee-validate": "web-forms-vee-validate",
    "zod-validation": "web-forms-zod-validation",

    // Testing
    vitest: "web-testing-vitest",
    "playwright-e2e": "web-testing-playwright-e2e",
    "cypress-e2e": "web-testing-cypress-e2e",
    "react-testing-library": "web-testing-react-testing-library",
    "vue-test-utils": "web-testing-vue-test-utils",
    msw: "web-mocks-msw",

    // UI Components
    "shadcn-ui": "web-ui-shadcn-ui",
    "tanstack-table": "web-ui-tanstack-table",
    "radix-ui": "web-ui-radix-ui",

    // Backend
    hono: "api-framework-hono",
    express: "api-framework-express",
    fastify: "api-framework-fastify",
    drizzle: "api-database-drizzle",
    prisma: "api-database-prisma",
    "better-auth": "api-auth-better-auth-drizzle-hono",
    "axiom-pino-sentry": "api-observability-axiom-pino-sentry",
    posthog: "api-analytics-posthog-analytics",
    "posthog-flags": "api-flags-posthog-flags",
    resend: "api-email-resend-react-email",
    "github-actions": "api-ci-cd-github-actions",

    // Mobile
    "react-native": "mobile-framework-react-native",
    expo: "mobile-framework-expo",

    // Infrastructure
    turborepo: "infra-monorepo-turborepo",
    tooling: "infra-tooling-setup-tooling",
    "posthog-setup": "api-analytics-setup-posthog",
    env: "infra-env-setup-env",
    "observability-setup": "api-observability-setup-axiom-pino-sentry",
    "email-setup": "api-email-setup-resend",

    // Animation, PWA, Realtime, etc.
    "framer-motion": "web-animation-framer-motion",
    "css-animations": "web-animation-css-animations",
    "view-transitions": "web-animation-view-transitions",
    storybook: "web-tooling-storybook",
    "error-boundaries": "web-error-handling-error-boundaries",
    "result-types": "web-error-handling-result-types",
    accessibility: "web-accessibility-web-accessibility",
    websockets: "web-realtime-websockets",
    sse: "web-realtime-sse",
    "socket-io": "web-realtime-socket-io",
    "service-workers": "web-pwa-service-workers",
    "offline-first": "web-pwa-offline-first",
    "file-upload": "web-files-file-upload-patterns",
    "image-handling": "web-files-image-handling",
    "date-fns": "web-utilities-date-fns",

    // Backend-specific
    "api-testing": "api-testing-api-testing",
    "api-performance": "api-performance-api-performance",
    "web-performance": "web-performance-web-performance",
    security: "security-auth-security",

    // CLI
    commander: "cli-framework-cli-commander",
    "cli-commander": "cli-framework-cli-commander",
    oclif: "cli-framework-oclif-ink",

    // Reviewing / Meta
    reviewing: "meta-reviewing-reviewing",
    "cli-reviewing": "meta-reviewing-cli-reviewing",
    "research-methodology": "meta-research-research-methodology",

    // Methodology
    "investigation-requirements": "meta-methodology-investigation-requirements",
    "anti-over-engineering": "meta-methodology-anti-over-engineering",
    "success-criteria": "meta-methodology-success-criteria",
    "write-verification": "meta-methodology-write-verification",
    "improvement-protocol": "meta-methodology-improvement-protocol",
    "context-management": "meta-methodology-context-management",
  },
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
      {
        when: "web-framework-react",
        suggest: [
          "web-state-zustand",
          "web-server-state-react-query",
          "web-testing-vitest",
          "web-forms-react-hook-form",
          "web-testing-react-testing-library",
        ],
        reason: "Best-in-class React libraries",
      },
      {
        when: "web-framework-nextjs-app-router",
        suggest: ["web-server-state-react-query", "web-state-zustand", "web-ui-shadcn-ui"],
        reason: "Next.js App Router ecosystem",
      },
      {
        when: "web-framework-remix",
        suggest: ["web-state-zustand", "web-testing-vitest", "web-forms-zod-validation"],
        reason: "Remix-compatible libraries",
      },
      {
        when: "web-framework-vue-composition-api",
        suggest: ["web-state-pinia", "web-forms-vee-validate", "web-testing-vue-test-utils"],
        reason: "Vue community standard libraries",
      },
      {
        when: "web-framework-angular-standalone",
        suggest: ["web-state-ngrx-signalstore"],
        reason: "Angular Signals-based state management",
      },
      {
        when: "web-framework-solidjs",
        suggest: ["web-testing-vitest", "web-styling-tailwind"],
        reason: "SolidJS-compatible libraries",
      },
      {
        when: "api-framework-hono",
        suggest: [
          "api-database-drizzle",
          "api-auth-better-auth-drizzle-hono",
          "web-forms-zod-validation",
        ],
        reason: "Hono + Drizzle + Better Auth is a powerful combo",
      },
      {
        when: "api-database-drizzle",
        suggest: ["web-forms-zod-validation"],
        reason: "Drizzle types work great with Zod",
      },
      {
        when: "web-styling-scss-modules",
        suggest: ["web-ui-radix-ui"],
        reason: "Radix primitives work well with any CSS approach",
      },
      {
        when: "web-styling-tailwind",
        suggest: ["web-ui-shadcn-ui", "web-styling-cva"],
        reason: "shadcn/ui is built for Tailwind; CVA provides type-safe variant management",
      },
      {
        when: "web-styling-cva",
        suggest: ["web-styling-tailwind"],
        reason: "CVA is designed for Tailwind utility classes",
      },
      {
        when: "web-ui-shadcn-ui",
        suggest: ["web-ui-radix-ui", "web-styling-tailwind"],
        reason: "shadcn/ui uses Radix primitives and Tailwind",
      },
      {
        when: "web-forms-react-hook-form",
        suggest: ["web-forms-zod-validation"],
        reason: "react-hook-form + Zod is the standard pattern",
      },
      {
        when: "web-forms-vee-validate",
        suggest: ["web-forms-zod-validation"],
        reason: "vee-validate supports Zod schemas",
      },
      {
        when: "web-testing-vitest",
        suggest: ["web-testing-react-testing-library", "web-mocks-msw"],
        reason: "Vitest + RTL + MSW is the modern testing stack",
      },
      {
        when: "web-testing-playwright-e2e",
        suggest: ["web-testing-vitest"],
        reason: "Playwright for E2E, Vitest for unit/integration",
      },
      {
        when: "web-server-state-react-query",
        suggest: ["web-forms-zod-validation"],
        reason: "Type-safe API responses with Zod",
      },
      {
        when: "mobile-framework-react-native",
        suggest: [
          "web-state-zustand",
          "web-server-state-react-query",
          "web-forms-react-hook-form",
          "web-forms-zod-validation",
        ],
        reason: "React Native shares React ecosystem",
      },
      {
        when: "api-observability-axiom-pino-sentry",
        suggest: ["api-analytics-posthog-analytics"],
        reason: "Complete observability with analytics",
      },
      {
        when: "api-framework-fastify",
        suggest: ["api-database-drizzle", "web-forms-zod-validation"],
        reason: "Fastify + Drizzle + Zod is a solid backend stack",
      },
      {
        when: "api-framework-express",
        suggest: ["api-database-prisma"],
        reason: "Express + Prisma is a classic combination",
      },
      {
        when: "web-framework-nuxt",
        suggest: ["web-state-pinia", "web-styling-tailwind", "web-testing-playwright-e2e"],
        reason: "Nuxt ecosystem libraries",
      },
      {
        when: "web-mocks-msw",
        suggest: ["web-testing-vitest", "web-testing-react-testing-library"],
        reason: "MSW + Vitest + RTL is the modern testing stack",
      },
      {
        when: "web-testing-cypress-e2e",
        suggest: ["web-testing-vitest"],
        reason: "Cypress for E2E, Vitest for unit tests",
      },
      {
        when: "cli-framework-oclif-ink",
        suggest: ["web-testing-vitest"],
        reason: "oclif pairs well with Vitest for CLI testing",
      },
      {
        when: "cli-framework-cli-commander",
        suggest: ["web-testing-vitest"],
        reason: "Commander pairs well with Vitest for CLI testing",
      },
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
  perSkill: {
    posthog: {
      compatibleWith: ["api-flags-posthog-flags"],
      requiresSetup: ["api-analytics-setup-posthog"],
    },
    "posthog-setup": {
      compatibleWith: [
        "api-analytics-posthog-analytics",
        "api-flags-posthog-flags",
        "infra-env-setup-env",
      ],
      providesSetupFor: ["api-analytics-posthog-analytics", "api-flags-posthog-flags"],
    },
    "posthog-flags": {
      compatibleWith: ["api-analytics-posthog-analytics"],
      requiresSetup: ["api-analytics-setup-posthog"],
    },
    "better-auth": {
      compatibleWith: [
        "api-framework-hono",
        "api-framework-express",
        "api-framework-fastify",
        "security-auth-security",
      ],
      requires: ["api-database-drizzle"],
    },
    "github-actions": {
      compatibleWith: ["infra-monorepo-turborepo", "infra-tooling-setup-tooling"],
    },
    drizzle: {
      compatibleWith: [
        "api-framework-hono",
        "api-framework-express",
        "api-framework-fastify",
        "api-auth-better-auth-drizzle-hono",
      ],
    },
    prisma: {
      compatibleWith: [
        "api-framework-hono",
        "api-framework-express",
        "api-framework-fastify",
        "api-auth-better-auth-drizzle-hono",
      ],
    },
    resend: {
      requiresSetup: ["api-email-setup-resend"],
    },
    "email-setup": {
      compatibleWith: ["api-email-resend-react-email", "infra-env-setup-env"],
      providesSetupFor: ["api-email-resend-react-email"],
    },
    express: {
      compatibleWith: [
        "api-auth-better-auth-drizzle-hono",
        "api-database-drizzle",
        "api-database-prisma",
        "security-auth-security",
        "api-observability-axiom-pino-sentry",
      ],
    },
    fastify: {
      compatibleWith: [
        "api-auth-better-auth-drizzle-hono",
        "api-database-drizzle",
        "api-database-prisma",
        "api-observability-axiom-pino-sentry",
        "security-auth-security",
      ],
    },
    hono: {
      compatibleWith: [
        "api-auth-better-auth-drizzle-hono",
        "api-database-drizzle",
        "api-database-prisma",
        "security-auth-security",
      ],
    },
    "axiom-pino-sentry": {
      requiresSetup: ["api-observability-setup-axiom-pino-sentry"],
    },
    "observability-setup": {
      compatibleWith: ["api-observability-axiom-pino-sentry", "infra-env-setup-env"],
      providesSetupFor: ["api-observability-axiom-pino-sentry"],
    },
    "api-performance": {
      compatibleWith: [
        "api-database-drizzle",
        "api-database-prisma",
        "api-framework-hono",
        "api-framework-express",
        "api-framework-fastify",
      ],
    },
    commander: {
      compatibleWith: ["infra-tooling-setup-tooling", "web-testing-vitest"],
    },
    oclif: {
      compatibleWith: ["web-framework-react", "web-state-zustand", "web-testing-vitest"],
      conflictsWith: ["cli-framework-cli-commander"],
    },
    env: {
      compatibleWith: ["security-auth-security", "infra-monorepo-turborepo"],
    },
    turborepo: {
      compatibleWith: ["infra-tooling-setup-tooling", "api-ci-cd-github-actions"],
    },
    tooling: {
      compatibleWith: ["infra-monorepo-turborepo"],
    },
    "cli-reviewing": {
      compatibleWith: ["meta-reviewing-reviewing", "web-testing-vitest"],
      requires: ["cli-framework-cli-commander"],
    },
    "react-native": {
      compatibleWith: [
        "web-state-zustand",
        "web-server-state-react-query",
        "web-forms-react-hook-form",
        "web-forms-zod-validation",
      ],
    },
    security: {
      compatibleWith: [
        "api-auth-better-auth-drizzle-hono",
        "api-framework-hono",
        "api-framework-express",
        "api-framework-fastify",
        "infra-env-setup-env",
      ],
    },
    accessibility: {
      compatibleWith: [
        "web-framework-react",
        "web-framework-vue-composition-api",
        "web-framework-angular-standalone",
        "web-framework-solidjs",
      ],
    },
    "css-animations": {
      compatibleWith: [
        "web-styling-scss-modules",
        "web-styling-tailwind",
        "web-accessibility-web-accessibility",
        "web-performance-web-performance",
      ],
    },
    "framer-motion": {
      compatibleWith: [
        "web-styling-scss-modules",
        "web-styling-tailwind",
        "web-accessibility-web-accessibility",
      ],
      requires: ["web-framework-react"],
    },
    "graphql-apollo": {
      compatibleWith: [
        "web-framework-react",
        "web-state-zustand",
        "web-state-jotai",
        "web-state-redux-toolkit",
      ],
    },
    "graphql-urql": {
      compatibleWith: [
        "web-framework-react",
        "web-state-zustand",
        "web-state-jotai",
        "web-state-redux-toolkit",
      ],
    },
    swr: {
      compatibleWith: [
        "web-framework-react",
        "web-framework-nextjs-app-router",
        "web-framework-nextjs-server-actions",
      ],
    },
    trpc: {
      compatibleWith: [
        "web-framework-react",
        "web-state-zustand",
        "web-state-jotai",
        "web-state-redux-toolkit",
      ],
    },
    "error-boundaries": {
      compatibleWith: ["web-framework-react"],
    },
    "result-types": {
      compatibleWith: [
        "web-framework-react",
        "api-framework-hono",
        "api-framework-express",
        "api-framework-fastify",
      ],
    },
    "file-upload": {
      compatibleWith: [
        "web-framework-react",
        "web-forms-react-hook-form",
        "web-forms-vee-validate",
        "api-framework-hono",
      ],
    },
    "image-handling": {
      compatibleWith: [
        "web-framework-react",
        "web-forms-react-hook-form",
        "web-forms-vee-validate",
      ],
    },
    "nextjs-app-router": {
      compatibleWith: [
        "web-styling-scss-modules",
        "web-styling-tailwind",
        "web-server-state-react-query",
        "web-state-zustand",
      ],
    },
    "nextjs-server-actions": {
      compatibleWith: [
        "web-forms-react-hook-form",
        "web-forms-zod-validation",
        "api-database-drizzle",
        "api-database-prisma",
        "api-auth-better-auth-drizzle-hono",
      ],
      requires: ["web-framework-nextjs-app-router"],
    },
    nuxt: {
      compatibleWith: ["web-forms-zod-validation", "web-testing-playwright-e2e"],
    },
    remix: {
      compatibleWith: [
        "web-styling-scss-modules",
        "web-styling-tailwind",
        "web-testing-vitest",
        "web-testing-playwright-e2e",
        "web-testing-cypress-e2e",
      ],
    },
    solidjs: {
      compatibleWith: [
        "web-styling-scss-modules",
        "web-styling-tailwind",
        "web-testing-vitest",
        "web-testing-playwright-e2e",
        "web-testing-cypress-e2e",
      ],
    },
    vue: {
      compatibleWith: [
        "web-styling-scss-modules",
        "web-styling-tailwind",
        "web-testing-vitest",
        "web-testing-playwright-e2e",
        "web-testing-cypress-e2e",
      ],
    },
    msw: {
      compatibleWith: [
        "web-testing-vitest",
        "web-testing-playwright-e2e",
        "web-testing-cypress-e2e",
        "web-server-state-react-query",
        "web-data-fetching-swr",
      ],
    },
    "web-performance": {
      compatibleWith: [
        "web-framework-react",
        "web-framework-vue-composition-api",
        "web-framework-angular-standalone",
        "web-framework-solidjs",
      ],
    },
    "offline-first": {
      compatibleWith: [
        "web-framework-react",
        "web-state-zustand",
        "web-state-jotai",
        "web-state-redux-toolkit",
      ],
    },
    "socket-io": {
      compatibleWith: [
        "web-framework-react",
        "web-state-zustand",
        "web-state-jotai",
        "web-state-redux-toolkit",
      ],
    },
    websockets: {
      compatibleWith: [
        "web-framework-react",
        "web-state-zustand",
        "web-state-jotai",
        "web-state-redux-toolkit",
      ],
    },
    "react-query": {
      compatibleWith: [
        "web-framework-react",
        "web-state-zustand",
        "web-state-jotai",
        "web-state-redux-toolkit",
      ],
    },
    jotai: {
      compatibleWith: [
        "web-framework-react",
        "web-server-state-react-query",
        "web-data-fetching-swr",
      ],
    },
    mobx: {
      compatibleWith: ["web-framework-react"],
      conflictsWith: ["web-state-zustand", "web-state-redux-toolkit"],
    },
    "ngrx-signalstore": {
      compatibleWith: [
        "web-framework-angular-standalone",
        "web-server-state-react-query",
        "web-data-fetching-swr",
      ],
    },
    pinia: {
      compatibleWith: [
        "web-framework-vue-composition-api",
        "web-server-state-react-query",
        "web-data-fetching-swr",
      ],
    },
    "redux-toolkit": {
      compatibleWith: [
        "web-framework-react",
        "web-server-state-react-query",
        "web-data-fetching-swr",
      ],
    },
    zustand: {
      compatibleWith: [
        "web-framework-react",
        "web-server-state-react-query",
        "web-data-fetching-swr",
      ],
    },
    cva: {
      compatibleWith: ["web-styling-scss-modules", "web-styling-tailwind"],
    },
    "scss-modules": {
      compatibleWith: [
        "web-framework-react",
        "web-framework-vue-composition-api",
        "web-framework-angular-standalone",
        "web-framework-solidjs",
      ],
    },
    tailwind: {
      compatibleWith: ["web-framework-react", "web-styling-cva"],
      conflictsWith: ["web-styling-scss-modules"],
    },
    "cypress-e2e": {
      compatibleWith: [
        "web-framework-react",
        "web-framework-vue-composition-api",
        "web-framework-angular-standalone",
        "web-framework-solidjs",
      ],
    },
    "playwright-e2e": {
      compatibleWith: [
        "web-framework-react",
        "web-framework-vue-composition-api",
        "web-framework-angular-standalone",
        "web-framework-solidjs",
      ],
    },
    "react-testing-library": {
      compatibleWith: ["web-framework-react", "web-testing-vitest"],
    },
    vitest: {
      compatibleWith: [
        "web-framework-react",
        "web-framework-vue-composition-api",
        "web-framework-angular-standalone",
        "web-framework-solidjs",
        "web-mocks-msw",
      ],
    },
    "vue-test-utils": {
      compatibleWith: ["web-framework-vue-composition-api", "web-state-pinia"],
    },
    storybook: {
      compatibleWith: [
        "web-framework-react",
        "web-framework-vue-composition-api",
        "web-framework-angular-standalone",
        "web-testing-vitest",
        "web-testing-playwright-e2e",
      ],
    },
    "shadcn-ui": {
      compatibleWith: ["web-framework-react", "web-styling-tailwind"],
    },
    "tanstack-table": {
      compatibleWith: [
        "web-framework-react",
        "web-framework-vue-composition-api",
        "web-framework-solidjs",
      ],
    },
  },
};
