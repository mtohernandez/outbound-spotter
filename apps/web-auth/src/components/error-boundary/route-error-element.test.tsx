import { render, screen } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { describe, expect, it } from "vitest";

import { RouteErrorElement } from "@/components/error-boundary/route-error-element";

function makeRouter(throwInLoader: () => unknown) {
  return createMemoryRouter(
    [
      {
        path: "/",
        loader: () => {
          throw throwInLoader();
        },
        element: <div>unused</div>,
        errorElement: <RouteErrorElement />,
      },
    ],
    { initialEntries: ["/"] },
  );
}

describe("RouteErrorElement (web-auth)", () => {
  it("renders the 404 copy when the route throws a Response with status 404", async () => {
    const router = makeRouter(() => new Response("", { status: 404, statusText: "Not Found" }));
    render(<RouterProvider router={router} />);

    expect(await screen.findByText(/we couldn't find that page/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /sign in/i })).toHaveAttribute("href", "/sign-in");
  });

  it("renders the generic copy when a non-Response error is thrown", async () => {
    const router = makeRouter(() => new Error("boom"));
    render(<RouterProvider router={router} />);

    expect(await screen.findByText(/couldn't load this page/i)).toBeInTheDocument();
  });
});
