import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AuthCard } from "./auth-card";

describe("AuthCard", () => {
  it("renders its children inside a shadcn Card", () => {
    const { getByTestId } = render(
      <AuthCard>
        <div data-testid="content">body</div>
      </AuthCard>,
    );

    expect(getByTestId("content")).toBeInTheDocument();
  });

  it("merges a consumer className with the default sizing classes", () => {
    const { container } = render(<AuthCard className="custom-class">child</AuthCard>);

    const card = container.firstElementChild;
    expect(card).not.toBeNull();
    expect(card?.className).toContain("custom-class");
    expect(card?.className).toContain("max-w-md");
  });
});
