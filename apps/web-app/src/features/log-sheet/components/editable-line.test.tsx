import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import { EditableLine } from "@/features/log-sheet/components/editable-line";

function StatefulLine({ initial = "" }: { initial?: string }): React.ReactElement {
  const [value, setValue] = useState(initial);
  return <EditableLine id="truck" label="Truck/Tractor #" value={value} onChange={setValue} />;
}

describe("EditableLine", () => {
  it("renders the sr-only label and an input wired to the id", () => {
    render(<EditableLine id="truck" label="Truck/Tractor #" value="" onChange={() => undefined} />);
    const label = screen.getByText("Truck/Tractor #");
    expect(label).toHaveClass("sr-only");
    expect(label.tagName.toLowerCase()).toBe("label");
    expect(label).toHaveAttribute("for", "truck");
    expect(screen.getByLabelText("Truck/Tractor #")).toHaveAttribute("id", "truck");
  });

  it("emits each keystroke via onChange when used as a controlled input", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<EditableLine id="truck" label="Truck/Tractor #" value="" onChange={onChange} />);

    const input = screen.getByLabelText("Truck/Tractor #");
    await user.type(input, "T");

    expect(onChange).toHaveBeenCalledWith("T");
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it("accumulates typed text when the parent persists state", async () => {
    const user = userEvent.setup();
    render(<StatefulLine />);

    const input = screen.getByLabelText("Truck/Tractor #");
    await user.type(input, "T-42");

    expect(input).toHaveValue("T-42");
  });

  it("renders a placeholder when value is empty", () => {
    render(
      <EditableLine
        id="truck"
        label="Truck/Tractor #"
        value=""
        onChange={() => undefined}
        placeholder="e.g. T-1024"
      />,
    );
    expect(screen.getByPlaceholderText("e.g. T-1024")).toBeInTheDocument();
  });

  it("renders as an underline-only input (no full box)", () => {
    render(<EditableLine id="x" label="X" value="abc" onChange={() => undefined} />);
    const input = screen.getByLabelText("X");
    expect(input).toHaveClass("border-0", "border-b", "rounded-none", "bg-transparent");
  });
});
