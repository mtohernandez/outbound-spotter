import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useForm } from "react-hook-form";
import { describe, expect, it, vi } from "vitest";

import type { TripInput } from "@/features/trip-planner/schemas/trip-input";
import { buildClerkMocks } from "@/testing/clerk-mocks";
import { renderWithProviders } from "@/testing/render";

const clerk = buildClerkMocks();

vi.mock("@clerk/react", () => ({
  useAuth: clerk.useAuth,
  useUser: clerk.useUser,
}));

const { AddressField } = await import("@/features/trip-planner/components/address-field");

function Harness(): React.ReactElement {
  const form = useForm<TripInput>({
    defaultValues: {
      current: { label: "", lat: 0, lon: 0, confidence: null },
      pickup: { label: "", lat: 0, lon: 0, confidence: null },
      dropoff: { label: "", lat: 0, lon: 0, confidence: null },
      cycleHoursUsed: 0,
    },
  });
  return (
    <AddressField
      control={form.control}
      name="current"
      label="Current location"
      placeholder="Where you are now"
    />
  );
}

describe("AddressField", () => {
  it("renders the placeholder when no address is selected", () => {
    renderWithProviders(<Harness />);

    expect(screen.getByRole("combobox", { name: /current location/i })).toHaveTextContent(
      /where you are now/i,
    );
  });

  it("opens the popover and shows the empty hint when fewer than 3 chars typed", async () => {
    const user = userEvent.setup();
    renderWithProviders(<Harness />);

    await user.click(screen.getByRole("combobox", { name: /current location/i }));

    expect(await screen.findByPlaceholderText(/search an address/i)).toBeInTheDocument();
    expect(screen.getByText(/type at least 3 characters/i)).toBeInTheDocument();
  });

  it("queries autocomplete and lets the user select a result", async () => {
    const user = userEvent.setup();
    renderWithProviders(<Harness />);

    await user.click(screen.getByRole("combobox", { name: /current location/i }));
    const input = await screen.findByPlaceholderText(/search an address/i);
    await user.type(input, "Richmond");

    const item = await screen.findByText(/Richmond, VA, USA/i, {}, { timeout: 3000 });
    await user.click(item);

    await waitFor(() => {
      expect(screen.getByRole("combobox", { name: /current location/i })).toHaveTextContent(
        /Richmond, VA, USA/i,
      );
    });
  });
});
