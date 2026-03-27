import { describe, it, expect } from "vitest";
import { isHotkey, HOTKEY_INFO, HOTKEY_TOGGLE_LABELS } from "./hotkeys";

describe("isHotkey", () => {
  it("should match case-insensitively", () => {
    expect(isHotkey("i", HOTKEY_INFO)).toBe(true);
    expect(isHotkey("I", HOTKEY_INFO)).toBe(true);
    expect(isHotkey("d", HOTKEY_TOGGLE_LABELS)).toBe(true);
    expect(isHotkey("D", HOTKEY_TOGGLE_LABELS)).toBe(true);
  });

  it("should reject non-matching input", () => {
    expect(isHotkey("x", HOTKEY_INFO)).toBe(false);
    expect(isHotkey("a", HOTKEY_TOGGLE_LABELS)).toBe(false);
  });
});
