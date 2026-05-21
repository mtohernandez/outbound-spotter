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

  it("re-attempts render and re-shows the fallback when Reload is clicked and the child still throws", async () => {
    function Container() {
      const [shouldThrow, setShouldThrow] = useState(true);
      return (
        <AppErrorBoundary>
          <ThrowOnce shouldThrow={shouldThrow} />
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

    // resetErrorBoundary() forces another render attempt; since the parent
    // hasn't been disarmed, the child throws again and the fallback re-shows.
    await user.click(screen.getByRole("button", { name: /reload/i }));

    expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();
  });
});
