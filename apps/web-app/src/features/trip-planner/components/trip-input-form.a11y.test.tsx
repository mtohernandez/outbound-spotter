import { axe } from "jest-axe";
import { describe, expect, it, vi } from "vitest";

import { buildClerkMocks } from "@/testing/clerk-mocks";
import { renderWithProviders } from "@/testing/render";

const clerk = buildClerkMocks();

vi.mock("@clerk/react", () => ({
  useAuth: clerk.useAuth,
  useUser: clerk.useUser,
}));

const { TripInputForm } = await import("@/features/trip-planner/components/trip-input-form");

describe("TripInputForm — a11y", () => {
  it("renders without axe-detectable accessibility violations", async () => {
    const { container } = renderWithProviders(<TripInputForm />);

    // axe-core needs the layout to settle; renderWithProviders mounts the form
    // synchronously so the snapshot below covers the labels, FieldGroup
    // associations, address combobox triggers, slider, datetime-local input,
    // and submit button.
    const results = await axe(container);

    expect(results).toHaveNoViolations();
  });
});
