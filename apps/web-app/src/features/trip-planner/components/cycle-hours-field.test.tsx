import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useForm } from "react-hook-form";
import { describe, expect, it } from "vitest";

import { CycleHoursField } from "@/features/trip-planner/components/cycle-hours-field";
import type { TripInput } from "@/features/trip-planner/schemas/trip-input";

function Harness({ defaultValue = 0 }: { defaultValue?: number }): React.ReactElement {
  const form = useForm<TripInput>({
    defaultValues: {
      current: { label: "x", lat: 0, lon: 0, confidence: null },
      pickup: { label: "x", lat: 0, lon: 0, confidence: null },
      dropoff: { label: "x", lat: 0, lon: 0, confidence: null },
      cycleHoursUsed: defaultValue,
    },
  });
  return <CycleHoursField control={form.control} />;
}

describe("CycleHoursField", () => {
  it("renders slider and numeric mirror", () => {
    render(<Harness defaultValue={35} />);

    const slider = screen.getByRole("slider");
    expect(slider).toHaveAttribute("aria-valuenow", "35");

    const input = screen.getByLabelText(/cycle hours used \(numeric input\)/i);
    expect(input).toHaveValue(35);
  });

  it("updates the numeric mirror when the user types", async () => {
    const user = userEvent.setup();
    render(<Harness defaultValue={0} />);

    const input = screen.getByLabelText(/cycle hours used \(numeric input\)/i);
    await user.clear(input);
    await user.type(input, "12.5");

    expect(input).toHaveValue(12.5);
  });

  it("shows the remaining-cycle label tied to the current value", () => {
    render(<Harness defaultValue={50} />);

    expect(screen.getByText(/20\.0 h remaining/i)).toBeInTheDocument();
  });
});
