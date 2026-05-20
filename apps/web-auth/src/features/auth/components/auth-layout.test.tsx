import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AuthLayout } from "./auth-layout";

describe("AuthLayout", () => {
  it("renders the skip-to-content link and a main landmark", () => {
    const { getByRole } = render(
      <AuthLayout>
        <div data-testid="form" />
      </AuthLayout>,
    );

    const skip = getByRole("link", { name: /skip to main content/i });
    expect(skip).toHaveAttribute("href", "#auth-main");

    const main = getByRole("main");
    expect(main.id).toBe("auth-main");
  });

  it("renders children inside the main landmark", () => {
    const { getByTestId, getByRole } = render(
      <AuthLayout>
        <div data-testid="form">payload</div>
      </AuthLayout>,
    );

    const main = getByRole("main");
    expect(main).toContainElement(getByTestId("form"));
  });

  it("renders the video aside and the decorative footer", () => {
    const { getByRole, getByText } = render(
      <AuthLayout>
        <div />
      </AuthLayout>,
    );

    expect(
      getByRole("complementary", { name: /outbound spotter atmosphere/i }),
    ).toBeInTheDocument();
    expect(getByText(/privacy/i)).toBeInTheDocument();
    expect(getByText(/terms/i)).toBeInTheDocument();
  });
});
