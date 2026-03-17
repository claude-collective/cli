# Skills & Stacks Gap Analysis

**Date:** 2026-03-16

Current inventory: 87 skills, 8 stacks, 36 categories, 7 domains.

---

## Missing Stacks

### HIGH Priority

| Stack               | Description                                                                                                                                                              | New Skills Needed                                                                                | Effort     |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------ | ---------- |
| **T3 Stack**        | Next.js + tRPC + Tailwind + Prisma + NextAuth — the default "type-safe fullstack" starter. 28.6k stars on create-t3-app. Used by Cal.com, YC startups.                   | 0-1 (api-auth-nextauth). Mostly composes existing skills: React, Next.js, tRPC, Prisma, Tailwind | **Low**    |
| **SvelteKit Stack** | Svelte 5 + SvelteKit — #3 frontend framework, 86k stars, 300% job growth YoY. No current representation at all.                                                          | 1 (web-framework-sveltekit)                                                                      | **Low**    |
| **Astro Stack**     | Content-first framework with islands architecture — 57k stars, acquired by Cloudflare, #2 meta-framework. Fills the "content site" gap none of the current stacks cover. | 1 (web-framework-astro)                                                                          | **Low**    |
| **Supabase Stack**  | Next.js/Nuxt + Supabase (Auth + Postgres + Realtime + Storage) — 99k stars, 36% of YC S24 batch. Fills the BaaS gap.                                                     | 1-2 (api-baas-supabase or split auth/db)                                                         | **Medium** |
| **AI-First Stack**  | Next.js + Vercel AI SDK + vector DB — AI SDK has 22.6k stars, 2.8M weekly npm downloads. The defining trend of 2025-2026.                                                | 2 (api-ai-vercel-ai-sdk, api-ai-rag-patterns)                                                    | **Medium** |

### MEDIUM Priority

| Stack                | Description                                                                                                    | New Skills Needed                   | Effort  |
| -------------------- | -------------------------------------------------------------------------------------------------------------- | ----------------------------------- | ------- |
| **MERN Stack**       | MongoDB + Express + React + Node — still the #1 fullstack by sheer volume. Dominant in bootcamps/job listings. | 1 (api-database-mongodb)            | **Low** |
| **Bun-Native Stack** | Bun + Elysia — 17.6k stars, 2-3.5x RPS vs Node. Interesting perf story.                                        | 1 (api-framework-elysia)            | **Low** |
| **Cloudflare Stack** | Workers + D1 + R2 + Pages — fastest-growing edge platform. Hono already runs natively on it.                   | 1 (infra-deploy-cloudflare-workers) | **Low** |

### LOW Priority (defer)

| Stack         | Why Low                                                                                              |
| ------------- | ---------------------------------------------------------------------------------------------------- |
| htmx          | Paradigm mismatch — server-rendered HTML fragments, typically Go/Python backends, not TypeScript SPA |
| AdonisJS      | Small community (18.5k stars), limited ecosystem                                                     |
| Tauri Desktop | 90k stars but requires Rust, needs new `desktop` domain                                              |

---

## Missing Skills

### HIGH Priority — Frameworks

| Skill                  | Category      | Why                                                      | Downloads/Stars         |
| ---------------------- | ------------- | -------------------------------------------------------- | ----------------------- |
| **Svelte + SvelteKit** | web-framework | #3 framework, 86k stars, highest dev satisfaction        | 3M weekly               |
| **Astro**              | web-framework | #2 meta-framework, content-first, islands architecture   | 1.25M weekly, 57k stars |
| **NestJS**             | api-framework | Dominant structured Node.js backend, Angular-inspired DI | 7.7M weekly, 75k stars  |

### HIGH Priority — Auth

| Skill                  | Category | Why                                                   | Downloads/Stars |
| ---------------------- | -------- | ----------------------------------------------------- | --------------- |
| **Auth.js / NextAuth** | api-auth | Dominant self-hosted auth for Next.js/SvelteKit       | 2.2-3.3M weekly |
| **Clerk**              | api-auth | Fastest-growing managed auth, pre-built UI components | 577k weekly     |

### HIGH Priority — Database / BaaS

| Skill                  | Category       | Why                                                            | Downloads/Stars        |
| ---------------------- | -------------- | -------------------------------------------------------------- | ---------------------- |
| **Supabase**           | api-baas (new) | Open-source Firebase alt: Postgres + Auth + Realtime + Storage | 5.2M weekly, 99k stars |
| **Firebase**           | api-baas (new) | Google BaaS: Firestore + Auth + Functions + FCM                | 5.6M weekly            |
| **MongoDB / Mongoose** | api-database   | Dominant NoSQL database                                        | 3.9M + 1.8M weekly     |
| **Redis / ioredis**    | api-database   | Universal caching, sessions, queues, pub/sub                   | 3.4M weekly            |

### HIGH Priority — AI

| Skill             | Category     | Why                                                                | Downloads/Stars          |
| ----------------- | ------------ | ------------------------------------------------------------------ | ------------------------ |
| **Vercel AI SDK** | api-ai (new) | Streaming AI toolkit, useChat/useCompletion, multi-provider        | 2.8M weekly, 22.6k stars |
| **OpenAI SDK**    | api-ai (new) | Most-used AI client: chat completions, function calling, streaming | 8.8M weekly              |

### HIGH Priority — Tools & Infrastructure

| Skill                 | Category           | Why                                                          | Downloads/Stars            |
| --------------------- | ------------------ | ------------------------------------------------------------ | -------------------------- |
| **Nx**                | shared-monorepo    | Full-featured monorepo system, generators, affected commands | 5-6M weekly                |
| **Vite (build tool)** | shared-tooling     | Default build tool for React/Vue/Svelte                      | 49-65M weekly, 78.5k stars |
| **Biome**             | shared-tooling     | Replacing ESLint + Prettier, 10-25x faster, Rust-based       | 2M weekly                  |
| **Docker**            | infra-deploy (new) | Universal containerization, every deployment needs it        | Universal                  |

### HIGH Priority — UI Libraries

| Skill                 | Category                      | Why                                       | Downloads/Stars            |
| --------------------- | ----------------------------- | ----------------------------------------- | -------------------------- |
| **Material UI (MUI)** | web-ui-components             | Largest React UI lib                      | 1.7-4.5M weekly, 97k stars |
| **Ant Design**        | web-ui-components             | Second-largest React UI, enterprise-grade | 2.6M weekly, 97.6k stars   |
| **Storybook**         | web-testing or shared-tooling | Component dev workshop standard           | 7-30M weekly               |

### HIGH Priority — Utilities

| Skill               | Category      | Why                                         | Downloads/Stars |
| ------------------- | ------------- | ------------------------------------------- | --------------- |
| **date-fns**        | web-utilities | The date utility standard, tree-shakeable   | 40.8M weekly    |
| **TanStack Router** | web-framework | Type-safe client-side routing, growing fast | 2.3M weekly     |

### MEDIUM Priority

| Skill                  | Category                | Why                                             | Downloads/Stars          |
| ---------------------- | ----------------------- | ----------------------------------------------- | ------------------------ |
| **Elysia**             | api-framework           | Bun-native, type-safe, growing fast             | 320k weekly, 17.6k stars |
| **Cloudflare Workers** | infra-deploy (new)      | Edge compute, D1/R2/KV bindings, Wrangler       | Growing fast             |
| **Headless UI**        | web-ui-components       | Unstyled accessible components by Tailwind Labs | 4.2M weekly              |
| **Mantine**            | web-ui-components       | Full-featured React lib with hooks              | 470k weekly              |
| **Chakra UI**          | web-ui-components       | Accessible component lib with style props       | 533k weekly              |
| **Vuetify**            | web-ui-components       | Material Design for Vue                         | 700k weekly, 41k stars   |
| **Payload CMS**        | api-cms (new)           | Next.js-native headless CMS, acquired by Figma  | 40.8k stars              |
| **Electron**           | desktop-framework (new) | Desktop app standard                            | 175k stars               |
| **Tauri**              | desktop-framework (new) | Modern desktop, system webview + Rust           | 120k stars               |
| **pnpm workspaces**    | shared-monorepo         | Workspace protocol for monorepos                | Used by Vue, Vite, Nuxt  |
| **TanStack Form**      | web-forms               | Type-safe form management, multi-framework      | Growing                  |
| **Docusaurus**         | shared-tooling          | React-powered docs framework by Meta            | 560k weekly              |
| **VitePress**          | shared-tooling          | Vue-powered static site gen for docs            | 393k weekly              |

---

## New Categories Needed

| Category         | Domain | Skills It Would Hold                    |
| ---------------- | ------ | --------------------------------------- |
| **api-ai**       | api    | Vercel AI SDK, OpenAI SDK, RAG patterns |
| **api-baas**     | api    | Supabase, Firebase                      |
| **infra-deploy** | infra  | Docker, Cloudflare Workers              |
| **api-cms**      | api    | Payload CMS, Sanity, Strapi             |

---

## Recommended Implementation Order

### Prerequisites (must complete before adding new framework skills/stacks)

- **D-38**: Split `web-framework` into `web-framework` + `web-meta-framework` categories, remove `web-base-framework` / `mobile-platform` pseudo-categories, merge Next.js skills into one
- **D-39**: Add "required by" label + block-deselect for meta→base coupling
- **D-105**: Split tooling skill (establishes Vite as standalone `web-tooling` skill)
- **D-101** (compatibleWith): Add framework scoping so NgRx, Pinia, Vue Test Utils etc. filter correctly

These establish the category model and skill patterns that all new skills must follow.

### Wave 1 — Highest value, lowest effort (mostly composes existing skills)

1. T3 Stack (0-1 new skills — composes React, Next.js, tRPC, Prisma, Tailwind)
2. SvelteKit stack + skill (1 new skill in `web-framework` + `web-meta-framework`)
3. Astro stack + skill (1 new skill in `web-meta-framework`, no base framework required)

### Wave 2 — High value, moderate effort

4. Auth.js/NextAuth + Clerk skills
5. Supabase stack + skill
6. AI-First stack + Vercel AI SDK + RAG patterns skills
7. NestJS skill

### Wave 3 — Fill remaining gaps

8. Nx, Vite (from D-105 split), Biome, Docker skills
9. MUI, Ant Design, Storybook skills
10. MongoDB, Redis skills
11. MERN stack, Bun-native stack, Cloudflare stack
