## Example Test Output

Here's what a complete, high-quality CLI test file handoff looks like:

```markdown
# Test Suite: Init Wizard Component

## Test File

`src/cli/commands/init/__tests__/init-wizard.test.tsx`

## Coverage Summary

- Rendering: 3 tests
- Keyboard Navigation: 4 tests
- Input Handling: 3 tests
- State Transitions: 2 tests
- Error Handling: 2 tests
- **Total: 14 tests**

## Test Categories

### Rendering

- displays welcome message on initial render
- shows all available options in selection list
- renders current step indicator

### Keyboard Navigation

- moves selection down with Arrow Down
- moves selection up with Arrow Up
- wraps selection at boundaries
- navigates between wizard steps

### Input Handling

- selects current option on Enter
- cancels wizard on Escape
- handles text input for project name

### State Transitions

- updates store when selection changes
- tracks navigation history for back button

### Error Handling

- displays error when directory already exists
- allows retry after validation failure

## Test Status

All tests: FAILING (ready for implementation)

## Escape Sequences Used

| Key        | Constant     | Value    |
| ---------- | ------------ | -------- |
| Arrow Down | `ARROW_DOWN` | `\x1B[B` |
| Arrow Up   | `ARROW_UP`   | `\x1B[A` |
| Enter      | `ENTER`      | `\r`     |
| Escape     | `ESCAPE`     | `\x1B`   |

## Expected Patterns

Developer should implement to make these tests pass:

- Use Zustand store for wizard state
- Use ink-testing-library for component tests
- Add delays after stdin.write calls
- Implement unmount cleanup in afterEach
```

This handoff gives the developer:

- Clear understanding of what to test
- Specific keyboard interactions to verify
- Pattern references for CLI test implementation
- Escape sequence reference for correct input simulation
