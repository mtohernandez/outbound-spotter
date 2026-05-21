import { describe, expect, it } from "vitest";

import { isModifierKey } from "@/features/trip-planner/utils/keyboard";

function event(init: KeyboardEventInit): KeyboardEvent {
  return new KeyboardEvent("keydown", init);
}

describe("isModifierKey", () => {
  it("is false for a plain key press", () => {
    expect(isModifierKey(event({ key: "r" }))).toBe(false);
  });

  it("is true when ctrlKey is held", () => {
    expect(isModifierKey(event({ key: "r", ctrlKey: true }))).toBe(true);
  });

  it("is true when metaKey is held", () => {
    expect(isModifierKey(event({ key: "r", metaKey: true }))).toBe(true);
  });

  it("is true when altKey is held", () => {
    expect(isModifierKey(event({ key: "r", altKey: true }))).toBe(true);
  });

  it("ignores shiftKey (Shift+R is still a valid action)", () => {
    expect(isModifierKey(event({ key: "r", shiftKey: true }))).toBe(false);
  });
});
