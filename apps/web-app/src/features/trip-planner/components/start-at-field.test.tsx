import { fireEvent, render, screen } from "@testing-library/react";
import { useForm } from "react-hook-form";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { StartAtField } from "@/features/trip-planner/components/start-at-field";
import type { TripInput } from "@/features/trip-planner/schemas/trip-input";

const FIXED_NOW = new Date("2030-05-20T15:07:00Z");

function Harness({ initialStartAt }: { initialStartAt?: string }): React.ReactElement {
  const form = useForm<TripInput>({
    defaultValues: {
      current: { label: "x", lat: 0, lon: 0, confidence: null },
      pickup: { label: "x", lat: 0, lon: 0, confidence: null },
      dropoff: { label: "x", lat: 0, lon: 0, confidence: null },
      cycleHoursUsed: 0,
      startAt: initialStartAt ?? "",
    },
  });
  return <StartAtField control={form.control} />;
}

describe("StartAtField", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(FIXED_NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders a datetime-local input with the Start time label", () => {
    render(<Harness />);

    const input = screen.getByLabelText(/start time/i);
    expect(input).toHaveAttribute("type", "datetime-local");
    expect(input).toHaveAttribute("step", "900");
  });

  it("describes the field with the helper text", () => {
    render(<Harness />);

    expect(screen.getByText(/15-minute increments/i)).toBeInTheDocument();
  });

  it("does NOT pin a `min` attribute — zod refine is the past-time source of truth", () => {
    // typescript-pro M1: capturing now-at-mount would lie to the user if
    // they linger past the default time. Submit-time validation rejects
    // past values; the picker stays open-ended.
    render(<Harness />);

    const input = screen.getByLabelText(/start time/i);
    expect(input).not.toHaveAttribute("min");
  });

  it("accepts a change event and propagates the new local value", () => {
    render(<Harness initialStartAt="2030-05-20T15:30:00Z" />);

    const input = screen.getByLabelText<HTMLInputElement>(/start time/i);
    // datetime-local inputs are hostile to userEvent.type under jsdom; fire
    // a synthetic change to mirror what the browser would emit.
    fireEvent.change(input, { target: { value: "2030-05-21T09:00" } });

    expect(input.value).toContain("2030-05-21");
  });
});
