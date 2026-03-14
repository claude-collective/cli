import { describe, it, expect } from "vitest";
import { isHotkey, HOTKEY_HELP, HOTKEY_TOGGLE_LABELS } from "./hotkeys";

describe("isHotkey", () => {
  it("should match case-insensitively", () => {
    expect(isHotkey("?", HOTKEY_HELP)).toBe(true);
    expect(isHotkey("d", HOTKEY_TOGGLE_LABELS)).toBe(true);
    expect(isHotkey("D", HOTKEY_TOGGLE_LABELS)).toBe(true);
  });

  it("should reject non-matching input", () => {
    expect(isHotkey("x", HOTKEY_HELP)).toBe(false);
    expect(isHotkey("a", HOTKEY_TOGGLE_LABELS)).toBe(false);
  });
});
