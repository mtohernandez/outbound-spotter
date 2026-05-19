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

    const skip = getByRole("link", { name: /skip to content/i });
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

  it("renders the video aside and the footer legal nav", () => {
    const { getByRole } = render(
      <AuthLayout>
        <div />
      </AuthLayout>,
    );

    expect(
      getByRole("complementary", { name: /outbound spotter atmosphere/i }),
    ).toBeInTheDocument();
    expect(getByRole("navigation", { name: /legal/i })).toBeInTheDocument();
  });
});
