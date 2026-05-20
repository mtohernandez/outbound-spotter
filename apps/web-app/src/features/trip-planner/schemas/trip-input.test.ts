import { describe, expect, it } from "vitest";

import {
  cycleHoursUsedSchema,
  resolvedAddressSchema,
  tripInputSchema,
} from "@/features/trip-planner/schemas/trip-input";

describe("resolvedAddressSchema", () => {
  it("accepts a valid resolved address", () => {
    const result = resolvedAddressSchema.safeParse({
      label: "Richmond, VA",
      lat: 37.5407,
      lon: -77.436,
      confidence: 0.93,
    });

    expect(result.success).toBe(true);
  });

  it("rejects an empty label", () => {
    const result = resolvedAddressSchema.safeParse({
      label: "",
      lat: 37.5407,
      lon: -77.436,
      confidence: null,
    });

    expect(result.success).toBe(false);
  });

  it("rejects out-of-range lat", () => {
    const result = resolvedAddressSchema.safeParse({
      label: "x",
      lat: 200,
      lon: 0,
      confidence: null,
    });

    expect(result.success).toBe(false);
  });
});

describe("cycleHoursUsedSchema", () => {
  it.each([0, 0.5, 35, 70])("accepts %s", (value) => {
    expect(cycleHoursUsedSchema.safeParse(value).success).toBe(true);
  });

  it.each([-1, 70.5, 0.25])("rejects %s", (value) => {
    expect(cycleHoursUsedSchema.safeParse(value).success).toBe(false);
  });
});

describe("tripInputSchema", () => {
  const valid = {
    label: "X",
    lat: 0,
    lon: 0,
    confidence: null,
  };

  it("accepts three resolved addresses + cycle hours", () => {
    const result = tripInputSchema.safeParse({
      current: valid,
      pickup: valid,
      dropoff: valid,
      cycleHoursUsed: 12,
    });

    expect(result.success).toBe(true);
  });

  it("rejects when any address is unresolved", () => {
    const result = tripInputSchema.safeParse({
      current: { ...valid, label: "" },
      pickup: valid,
      dropoff: valid,
      cycleHoursUsed: 0,
    });

    expect(result.success).toBe(false);
  });
});
