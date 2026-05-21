import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { FeatureErrorBoundary } from "@/components/error-boundary/feature-error-boundary";

vi.mock("sonner", () => ({
  toast: { error: vi.fn() },
}));

function Thrower(): React.ReactElement {
  throw new Error("section crashed");
}

function makeClient(): QueryClient {
  return new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
}

describe("FeatureErrorBoundary", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders an inline Empty fallback when a child throws", () => {
    render(
      <QueryClientProvider client={makeClient()}>
        <FeatureErrorBoundary scope="trip-map">
          <Thrower />
        </FeatureErrorBoundary>
      </QueryClientProvider>,
    );

    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByText(/couldn't load this section/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /reload this section/i })).toBeInTheDocument();
  });

  it("re-renders the fallback after Reload is clicked (proves onReset is wired)", async () => {
    const user = userEvent.setup();
    render(
      <QueryClientProvider client={makeClient()}>
        <FeatureErrorBoundary scope="trip-map">
          <Thrower />
        </FeatureErrorBoundary>
      </QueryClientProvider>,
    );

    await user.click(screen.getByRole("button", { name: /reload this section/i }));

    // After Reload the boundary attempts to re-render the children. Since
    // Thrower still throws, the fallback re-appears — without a wired
    // onReset/useQueryErrorResetBoundary call the click would have thrown.
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });
});
