import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ForgotPasswordRoute } from "@/app/routes/forgot-password";

describe("ForgotPasswordRoute (placeholder)", () => {
  it("renders the temporary scaffold copy", () => {
    const { getByText } = render(<ForgotPasswordRoute />);

    expect(getByText(/forgot password flow lands/i)).toBeInTheDocument();
  });
});
