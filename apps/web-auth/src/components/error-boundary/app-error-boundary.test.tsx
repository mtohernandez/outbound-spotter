import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AppErrorBoundary } from "@/components/error-boundary/app-error-boundary";

vi.mock("sonner", () => ({
  toast: { error: vi.fn() },
}));

function Thrower(): React.ReactElement {
  throw new Error("synthetic render failure");
}

describe("AppErrorBoundary (web-auth)", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders the fallback when a child throws during render", () => {
    render(
      <AppErrorBoundary>
        <Thrower />
      </AppErrorBoundary>,
    );

    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /reload/i })).toBeInTheDocument();
  });
});
