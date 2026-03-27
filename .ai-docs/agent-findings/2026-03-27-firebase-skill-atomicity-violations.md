---
type: anti-pattern
severity: high
affected_files:
  - /home/vince/dev/skills/src/skills/api-baas-firebase/examples/auth.md
  - /home/vince/dev/skills/src/skills/api-baas-firebase/examples/setup.md
  - /home/vince/dev/skills/src/skills/api-baas-firebase/SKILL.md
  - /home/vince/dev/skills/src/skills/api-baas-firebase/reference.md
standards_docs:
  - .ai-docs/standards/skill-atomicity-bible.md
  - .ai-docs/standards/prompt-bible.md
  - .ai-docs/standards/skill-atomicity-primer.md
date: 2026-03-27
reporting_agent: skill-summoner
category: architecture
domain: api
root_cause: convention-undocumented
---

## What Was Wrong

Four atomicity violations found in the `api-baas-firebase` skill:

1. **React framework coupling in auth.md** (HIGH severity, Category 1 + 8): The "Authentication with React Context" section imported directly from `"react"` (`createContext`, `useContext`, `useEffect`, `useState`, `ReactNode`) and used React-specific patterns (JSX, hooks, context providers). A commented-out usage example also referenced `<Navigate to="/login" />` from react-router. Firebase is a BaaS skill -- framework integration belongs in the framework skill, not here.

2. **Duplicate file: setup.md** (MEDIUM): `examples/setup.md` was byte-identical to `examples/core.md`. Stale duplicate wasting context on every invocation.

3. **Explicit external tool recommendations** (HIGH severity, Category 2): SKILL.md named Algolia, Typesense, Supabase, and AWS Amplify by name in "When NOT to use" and "Replaces / Conflicts with" sections.

4. **Framework-specific env prefixes in reference.md** (MEDIUM severity, Category 8): Referenced `NEXT_PUBLIC_` and `VITE_` as specific examples of framework public env prefixes.

## Fix Applied

1. Replaced the React Context auth section with a framework-agnostic `auth-service.ts` that exposes `subscribeToAuthState`, `signUp` (with Firestore profile), `signInWithGoogle` (with profile sync), `signIn`, and `logOut` -- all as plain exported functions with typed return values. Updated SKILL.md TOC and pattern link to match.
2. Deleted `examples/setup.md`.
3. Genericized tool references: "Algolia or Typesense" -> "a dedicated search service"; "Supabase" / "AWS Amplify" -> "Other BaaS platforms".
4. Removed `NEXT_PUBLIC_` and `VITE_` examples, keeping the generic guidance "use your framework's public env prefix".

## Proposed Standard

BaaS skills (Firebase, Supabase, etc.) should never include framework-specific UI integration patterns. The auth service pattern should be framework-agnostic -- each framework skill owns its own integration (React context, Vue composable, Svelte store, etc.). Add to skill-atomicity-bible.md Section 2 a note: "BaaS skills must not contain framework-specific UI integration code (React contexts, Vue composables). Expose plain TypeScript services; let framework skills handle the binding."
