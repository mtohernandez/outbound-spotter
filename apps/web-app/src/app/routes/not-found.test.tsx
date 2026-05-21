import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { describe, expect, it } from "vitest";

import { NotFoundRoute } from "@/app/routes/not-found";

describe("NotFoundRoute", () => {
  it("renders the on-brand 404 copy and the two CTAs", () => {
    render(
      <MemoryRouter>
        <NotFoundRoute />
      </MemoryRouter>,
    );

    expect(screen.getByText(/we couldn't find that page/i)).toBeInTheDocument();

    const planLink = screen.getByRole("link", { name: /plan a trip/i });
    expect(planLink).toHaveAttribute("href", "/trips/new");

    const savedLink = screen.getByRole("link", { name: /saved trips/i });
    expect(savedLink).toHaveAttribute("href", "/trips");
  });
});
