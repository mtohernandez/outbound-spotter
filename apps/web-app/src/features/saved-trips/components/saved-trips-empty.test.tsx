import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { describe, expect, it } from "vitest";

import { SavedTripsEmpty } from "@/features/saved-trips/components/saved-trips-empty";

describe("SavedTripsEmpty", () => {
  it("renders the empty title + description + plan-a-trip link", () => {
    render(
      <MemoryRouter>
        <SavedTripsEmpty />
      </MemoryRouter>,
    );

    expect(screen.getByText("No saved trips yet.")).toBeInTheDocument();
    expect(screen.getByText("Plan your first trip to see it here.")).toBeInTheDocument();
    const link = screen.getByRole("link", { name: "Plan a trip" });
    expect(link).toHaveAttribute("href", "/trips/new");
  });
});
