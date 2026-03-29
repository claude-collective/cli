---
type: anti-pattern
severity: high
affected_files:
  - src/cli/components/wizard/skill-agent-summary.tsx
standards_docs:
  - .ai-docs/reference/component-patterns.md
date: 2026-03-29
reporting_agent: cli-developer
category: architecture
domain: cli
root_cause: convention-undocumented
---

## What Was Wrong

`skill-agent-summary.tsx` used an explicit `height={availableHeight}` prop and a conditional return (`if (scrollEnabled) { return ... } return contentBox`) for its scroll implementation. This breaks the Yoga flex constraint chain and causes the view to collapse when rendered inside the InfoPanel.

The standard scroll pattern used by every other scrollable step (`step-agents.tsx`, `category-grid.tsx`, etc.) never sets an explicit `height` prop. Instead it relies on the flex constraint chain (`flexGrow={1}`) and uses conditional spread props:

```tsx
<Box flexDirection="row" flexGrow={1} {...(scrollEnabled && { overflow: "hidden" as const })}>
  <Box
    flexDirection="row"
    marginTop={scrollOffset > 0 ? -scrollOffset : 0}
    {...(scrollEnabled && { flexShrink: 0 })}
  >
    {content}
  </Box>
</Box>
```

Key aspects of the standard pattern:
- NO explicit `height` prop -- flex constraints determine viewport height
- `overflow: "hidden"` is CONDITIONAL on `scrollEnabled` (spread syntax)
- `flexShrink: 0` on the inner content wrapper is CONDITIONAL on `scrollEnabled`
- Content uses `marginTop: -scrollOffset` for scroll offset
- Single return path with conditional props, not conditional returns

## Fix Applied

Replaced the explicit `height` + conditional return pattern with the standard scroll wrapper pattern. Removed the redundant `flexShrink: 0` from the `contentBox` definition (it now lives on the scroll wrapper).

## Proposed Standard

Document the scroll container pattern in `.ai-docs/reference/component-patterns.md` under a "Scroll Containers" section:

1. **NEVER use explicit `height` props for scroll viewports** -- they break the Yoga flex constraint chain.
2. **ALWAYS use conditional `overflow: "hidden"` via spread syntax** on the outer wrapper.
3. **ALWAYS use conditional `flexShrink: 0` via spread syntax** on the inner content wrapper.
4. **ALWAYS use a single return path** with conditional props, not `if (scrollEnabled) { return A } return B`.
5. **Reference implementation:** `step-agents.tsx` lines 309-322.
