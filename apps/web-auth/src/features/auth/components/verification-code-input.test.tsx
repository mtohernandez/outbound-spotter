import { act, render } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import { VerificationCodeInput } from "./verification-code-input";

function Harness({ onComplete }: { onComplete?: (code: string) => void }) {
  const [code, setCode] = useState("");
  return <VerificationCodeInput value={code} onChange={setCode} onComplete={onComplete} />;
}

describe("VerificationCodeInput", () => {
  it("renders 6 inputs with one-time-code autocomplete and numeric inputmode", () => {
    const { getAllByRole } = render(<Harness />);
    const cells = getAllByRole("textbox");

    expect(cells).toHaveLength(6);
    for (const cell of cells) {
      expect(cell).toHaveAttribute("inputmode", "numeric");
      expect(cell).toHaveAttribute("autocomplete", "one-time-code");
    }
  });

  it("auto-advances focus when a digit is typed", async () => {
    const user = userEvent.setup();
    const { getAllByRole } = render(<Harness />);
    const cells = getAllByRole("textbox") as HTMLInputElement[];

    act(() => {
      cells[0]?.focus();
    });
    await user.keyboard("1");

    expect(document.activeElement).toBe(cells[1]);
    expect(cells[0]?.value).toBe("1");
  });

  it("backspaces to the previous cell when the current is empty", async () => {
    const user = userEvent.setup();
    const { getAllByRole } = render(<Harness />);
    const cells = getAllByRole("textbox") as HTMLInputElement[];

    act(() => {
      cells[0]?.focus();
    });
    await user.keyboard("1");
    expect(document.activeElement).toBe(cells[1]);
    await user.keyboard("{Backspace}");

    expect(document.activeElement).toBe(cells[0]);
  });

  it("distributes a 6-digit pasted string across cells and fires onComplete", async () => {
    const user = userEvent.setup();
    const onComplete = vi.fn();
    const { getAllByRole } = render(<Harness onComplete={onComplete} />);
    const cells = getAllByRole("textbox") as HTMLInputElement[];

    act(() => {
      cells[0]?.focus();
    });
    await user.paste("987654");

    expect(cells.map((cell) => cell.value).join("")).toBe("987654");
    expect(onComplete).toHaveBeenCalledWith("987654");
  });
});
