# CLI UX - Task Tracking

> Dedicated tracking for CLI UX/UI improvements.
> For the full redesign spec, see [docs/wizard-ux-redesign.md](./docs/wizard-ux-redesign.md).
> For concerns and decisions, see [docs/wizard-ux-redesign-concerns.md](./docs/wizard-ux-redesign-concerns.md).
> For research findings, see [docs/CLI-IMPROVEMENTS-RESEARCH.md](./docs/CLI-IMPROVEMENTS-RESEARCH.md).

---

## Active Tasks

| ID    | Task                                                      | Status      | Notes                                                                                                  |
| ----- | --------------------------------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------ |
| UX-01 | Style the home screen                                     | IN PROGRESS | Initial layout, branding, and navigation styling for the CLI home screen                               |
| UX-10 | Refactor command files - Option A (extract logic to lib/) | IN PROGRESS | Start with init.tsx, then all commands. See [docs/init-refactor-plan.md](./docs/init-refactor-plan.md) |

---

## Completed Tasks

| ID  | Task                                    | Status | Notes                                                       |
| --- | --------------------------------------- | ------ | ----------------------------------------------------------- |
| U1  | Progress navigation bar - tab styling   | DONE   | Green bg active, white bg completed, no circles             |
| U2  | Header - add version display            | DONE   | Pass `this.config.version` from Init command                |
| U3  | Footer - split layout with WizardFooter | DONE   | Left: nav controls, right: action hints                     |
| U4  | Build step - framework-first flow       | DONE   | Hide categories until framework selected, background colors |
| U5  | Import third-party skills command       | DONE   | `cc import skill github:owner/repo`                         |

---

## Backlog

| ID    | Task                                                           | Priority | Notes                                            |
| ----- | -------------------------------------------------------------- | -------- | ------------------------------------------------ |
| UX-02 | Align skills-matrix categories with domains                    | Medium   | Rename `frontend`/`backend` to `web`/`api`       |
| UX-03 | Build step UX improvements (column alignment, show all toggle) | Medium   | See TODO-deferred.md D-10                        |
| UX-04 | Interactive skill search polish                                | Medium   | Manual testing + tests for interactive component |
| UX-05 | Refine step - skills.sh integration                            | Low      | Community skill alternatives in Refine step      |
| UX-06 | Search with color highlighting                                 | Low      | Deferred - needs more UX thought                 |
| UX-07 | Incompatibility tooltips                                       | Low      | Show reason when hovering disabled options       |
| UX-08 | Keyboard shortcuts help overlay                                | Low      | In-wizard help for keybindings                   |
| UX-09 | Animations/transitions                                         | Low      | Polish pass for step transitions                 |
