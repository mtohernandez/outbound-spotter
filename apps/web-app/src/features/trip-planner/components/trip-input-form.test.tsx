import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { buildClerkMocks } from "@/testing/clerk-mocks";
import { renderWithProviders } from "@/testing/render";

const clerk = buildClerkMocks();

vi.mock("@clerk/react", () => ({
  useAuth: clerk.useAuth,
  useUser: clerk.useUser,
}));

// Import AFTER vi.mock so the component sees the mocked Clerk hooks.
const { TripInputForm } = await import("@/features/trip-planner/components/trip-input-form");

describe("TripInputForm", () => {
  it("renders three address fields, the cycle-hours slider, the start time picker, and a submit button", () => {
    renderWithProviders(<TripInputForm />);

    expect(screen.getByRole("combobox", { name: /current location/i })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: /pickup/i })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: /dropoff/i })).toBeInTheDocument();
    expect(screen.getByRole("slider")).toBeInTheDocument();
    expect(screen.getByLabelText(/start time/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /plan trip/i })).toBeInTheDocument();
  });

  it("shows the 1-hour-stop hints under pickup and dropoff", () => {
    renderWithProviders(<TripInputForm />);

    const stopHints = screen.getAllByText(/1 hour on-duty stop/i);
    expect(stopHints).toHaveLength(2);
  });

  it("mounts the start time picker as a datetime-local input below the slider", () => {
    renderWithProviders(<TripInputForm />);

    const startInput = screen.getByLabelText(/start time/i);
    expect(startInput).toHaveAttribute("type", "datetime-local");
  });
});
