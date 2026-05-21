import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { LogSheetHeader } from "@/features/log-sheet/components/log-sheet-header";
import { createEmptyMetadata } from "@/features/log-sheet/types/sheet-metadata";
import type { LogDay } from "@/features/trip-planner/schemas/trip-plan";

function makeDay(partial: Partial<LogDay>): LogDay {
  return {
    id: "00000000-0000-4000-8000-000000000001",
    date: "2026-05-21",
    off_duty_s: 0,
    sleeper_s: 0,
    driving_s: 0,
    on_duty_not_driving_s: 0,
    total_miles: 342.7,
    ...partial,
  };
}

describe("LogSheetHeader", () => {
  it("renders the driver's legal name and the date formatted in the home terminal tz", () => {
    render(
      <LogSheetHeader
        day={makeDay({})}
        homeTerminalTz="America/New_York"
        driverLegalName="Jane Driver"
        metadata={createEmptyMetadata()}
        onMetadataChange={() => undefined}
        idPrefix="sheet-1"
      />,
    );
    expect(screen.getByText("Jane Driver")).toBeInTheDocument();
    // 2026-05-21 in New York is Thursday — header label confirms tz anchoring.
    expect(screen.getByText(/Thursday, May 21, 2026/)).toBeInTheDocument();
  });

  it("renders total miles with one decimal", () => {
    render(
      <LogSheetHeader
        day={makeDay({ total_miles: 342.7 })}
        homeTerminalTz="America/New_York"
        driverLegalName="Jane Driver"
        metadata={createEmptyMetadata()}
        onMetadataChange={() => undefined}
        idPrefix="sheet-1"
      />,
    );
    expect(screen.getByText("342.7 mi")).toBeInTheDocument();
  });

  it("renders the friendly tz label", () => {
    render(
      <LogSheetHeader
        day={makeDay({})}
        homeTerminalTz="America/Chicago"
        driverLegalName="Jane Driver"
        metadata={createEmptyMetadata()}
        onMetadataChange={() => undefined}
        idPrefix="sheet-1"
      />,
    );
    expect(screen.getByText("Central")).toBeInTheDocument();
  });

  it("renders editable lines for vehicle / carrier / address / co-driver", () => {
    render(
      <LogSheetHeader
        day={makeDay({})}
        homeTerminalTz="America/New_York"
        driverLegalName="Jane Driver"
        metadata={createEmptyMetadata()}
        onMetadataChange={() => undefined}
        idPrefix="sheet-1"
      />,
    );
    expect(screen.getByLabelText("Truck or Tractor number")).toBeInTheDocument();
    expect(screen.getByLabelText("Trailer number")).toBeInTheDocument();
    expect(screen.getByLabelText("Name of carrier(s)")).toBeInTheDocument();
    expect(screen.getByLabelText("Main office address")).toBeInTheDocument();
    expect(screen.getByLabelText("Name of co-driver")).toBeInTheDocument();
  });

  it("invokes onMetadataChange with the next metadata when truck# changes", async () => {
    const onMetadataChange = vi.fn();
    const user = userEvent.setup();
    const baseMeta = createEmptyMetadata();
    render(
      <LogSheetHeader
        day={makeDay({})}
        homeTerminalTz="America/New_York"
        driverLegalName="Jane Driver"
        metadata={baseMeta}
        onMetadataChange={onMetadataChange}
        idPrefix="sheet-1"
      />,
    );
    await user.type(screen.getByLabelText("Truck or Tractor number"), "T");
    expect(onMetadataChange).toHaveBeenCalledWith({ ...baseMeta, truckNumber: "T" });
  });

  it("renders the ORIGINAL / DUPLICATE retention notices", () => {
    render(
      <LogSheetHeader
        day={makeDay({})}
        homeTerminalTz="America/New_York"
        driverLegalName="Jane Driver"
        metadata={createEmptyMetadata()}
        onMetadataChange={() => undefined}
        idPrefix="sheet-1"
      />,
    );
    expect(screen.getByText(/Original/i)).toBeInTheDocument();
    expect(screen.getByText(/Duplicate/i)).toBeInTheDocument();
  });
});
