import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { reportableError } from "./reportable-error";

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
  },
}));

const { toast } = await import("sonner");

describe("reportableError", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.mocked(toast.error).mockClear();
  });

  it("toasts the message of an Error instance with no extra options", () => {
    reportableError(new Error("Trip planning failed"));

    expect(toast.error).toHaveBeenCalledWith("Trip planning failed");
  });

  it("toasts a fallback message for non-Error inputs", () => {
    reportableError("string thrown");

    expect(toast.error).toHaveBeenCalledWith("Something went wrong");
  });

  it("does NOT pass scope through to the user-facing toast", () => {
    reportableError(new Error("Network down"), "plan-trip");

    // scope is dev-only — toast.error must be called with the message only.
    expect(toast.error).toHaveBeenCalledWith("Network down");
    expect(toast.error).not.toHaveBeenCalledWith("Network down", expect.anything());
  });

  it("writes the scope tag and underlying error to console.error", () => {
    const consoleError = vi.spyOn(console, "error");
    const cause = new Error("boom");

    reportableError(cause, "scope");

    expect(consoleError).toHaveBeenCalledWith("[reportable]", "scope", cause);
  });

  it("preserves Error.cause for telemetry consumers (logged via console.error)", () => {
    const consoleError = vi.spyOn(console, "error");
    const original = new Error("original failure");
    const wrapped = new Error("wrapped message", { cause: original });

    reportableError(wrapped, "test");

    const lastCallArgs = consoleError.mock.calls.at(-1);
    expect(lastCallArgs?.[2]).toBe(wrapped);
    expect((lastCallArgs?.[2] as Error).cause).toBe(original);
  });
});
