import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router";
import { describe, expect, it } from "vitest";

import { RouteErrorElement } from "@/components/error-boundary/route-error-element";

function makeRouter(throwInLoader: () => unknown) {
  let loadCount = 0;
  return {
    router: createMemoryRouter(
      [
        {
          path: "/",
          loader: () => {
            loadCount += 1;
            throw throwInLoader();
          },
          element: <div>unused</div>,
          errorElement: <RouteErrorElement />,
        },
      ],
      { initialEntries: ["/"] },
    ),
    getLoadCount: (): number => loadCount,
  };
}

describe("RouteErrorElement", () => {
  it("renders the 404 copy when the route throws an ErrorResponse with status 404", async () => {
    const { router } = makeRouter(() => new Response("", { status: 404, statusText: "Not Found" }));
    render(<RouterProvider router={router} />);

    expect(await screen.findByText(/we couldn't find that page/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /plan a trip/i })).toBeInTheDocument();
  });

  it("renders the generic copy when a non-Response error is thrown", async () => {
    const { router } = makeRouter(() => new Error("boom"));
    render(<RouterProvider router={router} />);

    expect(await screen.findByText(/couldn't load this page/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /reload/i })).toBeInTheDocument();
  });

  it("re-runs the loader when Reload is clicked (navigate(0) refresh)", async () => {
    const { router, getLoadCount } = makeRouter(() => new Error("boom"));
    render(<RouterProvider router={router} />);

    await screen.findByText(/couldn't load this page/i);
    const initialLoads = getLoadCount();

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /reload/i }));

    expect(getLoadCount()).toBeGreaterThan(initialLoads);
  });
});
