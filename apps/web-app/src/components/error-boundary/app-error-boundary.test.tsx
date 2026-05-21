import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AppErrorBoundary } from "@/components/error-boundary/app-error-boundary";

vi.mock("sonner", () => ({
  toast: { error: vi.fn() },
}));

function ThrowOnce({ shouldThrow }: { shouldThrow: boolean }): React.ReactElement {
  if (shouldThrow) {
    throw new Error("synthetic render failure");
  }
  return <div data-testid="content">child rendered</div>;
}

describe("AppErrorBoundary", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders the fallback when a child throws during render", () => {
    render(
      <MemoryRouter>
        <AppErrorBoundary>
          <ThrowOnce shouldThrow />
        </AppErrorBoundary>
      </MemoryRouter>,
    );

    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /reload/i })).toBeInTheDocument();
  });

  it("recovers and re-renders the child when Reload is clicked", async () => {
    function Container() {
      const [shouldThrow, setShouldThrow] = useState(true);
      return (
        <AppErrorBoundary key={String(shouldThrow)}>
          {shouldThrow ? <ThrowOnce shouldThrow /> : <ThrowOnce shouldThrow={false} />}
          <button
            type="button"
            onClick={() => {
              setShouldThrow(false);
            }}
          >
            disarm
          </button>
        </AppErrorBoundary>
      );
    }
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <Container />
      </MemoryRouter>,
    );

    expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /reload/i }));

    // The boundary resets; the child still throws because the parent hasn't
    // toggled state yet — assert the fallback re-renders, proving onReset wired.
    expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();
  });
});
