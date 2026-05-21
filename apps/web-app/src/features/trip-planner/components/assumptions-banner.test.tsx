import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { TRIP_ASSUMPTIONS } from "@/config/strings";
import { AssumptionsBanner } from "@/features/trip-planner/components/assumptions-banner";

function clearDismissals(): void {
  for (let i = window.localStorage.length - 1; i >= 0; i -= 1) {
    const key = window.localStorage.key(i);
    if (key?.startsWith("outbound-assumptions-dismissed:") === true) {
      window.localStorage.removeItem(key);
    }
  }
}

describe("AssumptionsBanner", () => {
  beforeEach(() => {
    clearDismissals();
  });

  afterEach(() => {
    clearDismissals();
  });

  it("renders the verbatim assignment-brief assumptions", () => {
    render(<AssumptionsBanner tripId="trip-1" />);

    for (const text of TRIP_ASSUMPTIONS) {
      expect(screen.getByText(text)).toBeInTheDocument();
    }
  });

  it("hides on dismiss and persists the choice for the same trip id", async () => {
    const user = userEvent.setup();
    const { rerender } = render(<AssumptionsBanner tripId="trip-1" />);

    await user.click(screen.getByRole("button", { name: /dismiss assumptions banner/i }));

    expect(screen.queryByText(TRIP_ASSUMPTIONS[0]!)).not.toBeInTheDocument();

    // Re-mount with the same id — dismissal persists.
    rerender(<AssumptionsBanner tripId="trip-1" />);
    expect(screen.queryByText(TRIP_ASSUMPTIONS[0]!)).not.toBeInTheDocument();
  });

  it("re-shows for a different trip id even after one was dismissed", async () => {
    const user = userEvent.setup();
    const { rerender } = render(<AssumptionsBanner tripId="trip-1" />);

    await user.click(screen.getByRole("button", { name: /dismiss assumptions banner/i }));

    rerender(<AssumptionsBanner tripId="trip-2" />);
    expect(screen.getByText(TRIP_ASSUMPTIONS[0]!)).toBeInTheDocument();
  });
});
