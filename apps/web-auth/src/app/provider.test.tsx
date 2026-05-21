import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { AppProvider } from "@/app/provider";

vi.mock("@clerk/react", () => ({
  ClerkProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

describe("AppProvider", () => {
  it("renders children inside the provider tree", () => {
    const { getByTestId } = render(
      <AppProvider>
        <span data-testid="child">child</span>
      </AppProvider>,
    );

    expect(getByTestId("child")).toBeInTheDocument();
  });

  it("applies dark theme to the documentElement when localStorage seeds dark", () => {
    window.localStorage.setItem("outbound-theme", "dark");

    render(
      <AppProvider>
        <span />
      </AppProvider>,
    );

    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });

  it("mounts the Sonner toaster region exactly once", async () => {
    const { findAllByLabelText } = render(
      <AppProvider>
        <span />
      </AppProvider>,
    );

    const toasters = await findAllByLabelText(/notifications/i);
    expect(toasters).toHaveLength(1);
  });
});
