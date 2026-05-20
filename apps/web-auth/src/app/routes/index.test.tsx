import { render } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { describe, expect, it } from "vitest";

import { IndexRoute } from "@/app/routes/index";

describe("IndexRoute", () => {
  it("redirects to /sign-in with replace semantics", () => {
    const { getByTestId } = render(
      <MemoryRouter initialEntries={["/"]}>
        <Routes>
          <Route path="/" element={<IndexRoute />} />
          <Route path="/sign-in" element={<span data-testid="sign-in-page" />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(getByTestId("sign-in-page")).toBeInTheDocument();
  });
});
