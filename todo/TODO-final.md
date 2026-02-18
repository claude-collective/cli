# Agents Inc. CLI - Final TODO

These are the remaining tasks to complete for the CLI.

| ID             | Task                              | Status  |
| -------------- | --------------------------------- | ------- |
| WUX-3          | Visually verify wizard UX changes | Pending |
| U-UI-ITERATION | Wizard UI polish pass             | Pending |
| U-LOGO         | Upload logo / branding asset      | Pending |
| #15            | Create Agents Inc. logo           | Pending |
| #2             | Add proper documentation          | Pending |
| #1             | Create proper Work web stack      | Pending |
| U15            | Add comprehensive help overlay    | Pending |

---

## WUX-3: Visually Verify Wizard UX Changes

The agents reported success on wizard UX changes but visual verification is needed. Manually verify:

- No icons in skill tags
- No colored borders on unfocused tags
- Stable skill order
- Proper tag wrapping on narrow terminals

**Action:** Manual testing with `agentsinc init` or `agentsinc edit` in an 80-column terminal.

---

## U-UI-ITERATION: Wizard UI Polish Pass

Iterate over the full wizard UI to improve visual consistency, spacing, and clarity across all steps (Stack, Build, Sources, Confirm). Review column widths, alignment, color usage, empty states, and overall visual hierarchy.

**Files:** `src/cli/components/wizard/`

---

## U-LOGO: Upload Logo / Branding Asset

Upload the Agents Inc. logo asset so it can be referenced from the README, marketplace listing, and any future web presence. (See also #15 — logo design.)

**Files:** `README.md`, potentially `assets/` or `public/`

---

## #15: Create Agents Inc. Logo

Design and create a logo for the Agents Inc. brand. The logo should be professional, scalable (vector format), and suitable for use in CLI interface, documentation, GitHub, and marketing materials. Consider creating multiple variations (full logo, icon only, monochrome).

---

## #2: Add Proper Documentation

Create comprehensive documentation covering the project structure, usage patterns, configuration options, and development guidelines. This should help developers understand and contribute to the project effectively.

---

## #1: Create Proper Work Web Stack

Build a comprehensive web stack configuration for work-related projects. This should include all necessary tooling, frameworks, and configurations needed for professional web development.

---

## U15: Add Comprehensive Help Overlay (also UX-08)

Add a comprehensive help section/overlay accessible via `?` key to show users how to get the most out of the CLI. This consolidates the deferred UX-08 (keyboard shortcuts help overlay) task.

- Keyboard shortcuts (expand on existing help modal)
- Navigation patterns
- Tips for wizard flow
- Common workflows (init, edit, compile, update)
- Source management tips
- Expert mode features
- Context-sensitive help (different content per step)
- In-wizard help for keybindings (from UX-08)

**Files:** `src/cli/components/wizard/help-modal.tsx`
