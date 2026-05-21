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

  it("toasts the message of an Error instance", () => {
    reportableError(new Error("Trip planning failed"));

    expect(toast.error).toHaveBeenCalledWith("Trip planning failed", undefined);
  });

  it("toasts a fallback message for non-Error inputs", () => {
    reportableError("string thrown");

    expect(toast.error).toHaveBeenCalledWith("Something went wrong", undefined);
  });

  it("includes the optional context as toast description", () => {
    reportableError(new Error("Network down"), "Saving trip");

    expect(toast.error).toHaveBeenCalledWith("Network down", { description: "Saving trip" });
  });

  it("always writes to console.error so the underlying error is observable", () => {
    const consoleError = vi.spyOn(console, "error");
    const cause = new Error("boom");

    reportableError(cause, "scope");

    expect(consoleError).toHaveBeenCalledWith("[reportable]", "scope", cause);
  });
});
