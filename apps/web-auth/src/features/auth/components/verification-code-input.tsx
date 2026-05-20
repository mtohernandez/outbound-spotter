import { Input } from "@outbound/ui/components/ui/input";
import {
  useCallback,
  useId,
  useImperativeHandle,
  useRef,
  type ClipboardEvent,
  type KeyboardEvent,
  type Ref,
} from "react";

interface Props {
  readonly value: string;
  readonly onChange: (next: string) => void;
  readonly onComplete?: ((code: string) => void | Promise<void>) | undefined;
  readonly length?: number;
  readonly disabled?: boolean;
  readonly ref?: Ref<VerificationCodeInputHandle>;
}

export interface VerificationCodeInputHandle {
  focus: () => void;
}

const ONLY_DIGITS = /[^0-9]/g;

export function VerificationCodeInput({
  value,
  onChange,
  onComplete,
  length = 6,
  disabled,
  ref,
}: Props): React.ReactElement {
  const groupLabelId = useId();
  const cellsBaseId = useId();
  const cellRefs = useRef<HTMLInputElement[]>([]);

  const cells = Array.from({ length }, (_, index) => value[index] ?? "");

  const setCellRef = (node: HTMLInputElement | null, index: number) => {
    if (node) cellRefs.current[index] = node;
  };

  useImperativeHandle(ref, () => ({
    focus: () => cellRefs.current[0]?.focus(),
  }));

  const focusCell = useCallback(
    (index: number) => {
      const target = Math.max(0, Math.min(index, length - 1));
      cellRefs.current[target]?.focus();
    },
    [length],
  );

  const writeAt = useCallback(
    (index: number, char: string) => {
      const filtered = char.replace(ONLY_DIGITS, "").slice(0, 1);
      if (!filtered) return;
      const chars = cells.slice();
      chars[index] = filtered;
      const next = chars.join("");
      onChange(next);
      if (next.length === length && !next.includes(" ")) {
        void onComplete?.(next);
      }
      focusCell(index + 1);
    },
    [cells, focusCell, length, onChange, onComplete],
  );

  const onPaste = (event: ClipboardEvent<HTMLInputElement>) => {
    const pasted = event.clipboardData.getData("text").replace(ONLY_DIGITS, "");
    if (!pasted) return;
    event.preventDefault();
    const slice = pasted.slice(0, length);
    onChange(slice);
    const lastIndex = Math.min(slice.length, length) - 1;
    focusCell(lastIndex >= 0 ? lastIndex + 1 : 0);
    if (slice.length === length) {
      void onComplete?.(slice);
    }
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>, index: number) => {
    if (event.key === "Backspace") {
      if (cells[index]) {
        const chars = cells.slice();
        chars[index] = "";
        onChange(chars.join(""));
        event.preventDefault();
        return;
      }
      focusCell(index - 1);
      event.preventDefault();
      return;
    }
    if (event.key === "ArrowLeft") {
      focusCell(index - 1);
      event.preventDefault();
      return;
    }
    if (event.key === "ArrowRight") {
      focusCell(index + 1);
      event.preventDefault();
    }
  };

  return (
    <div role="group" aria-labelledby={groupLabelId} className="flex flex-col gap-1">
      <span id={groupLabelId} className="sr-only">
        Verification code
      </span>
      <div className="flex items-center gap-2">
        {cells.map((char, index) => (
          <Input
            // OTP cells are positional and never reorder — index is the canonical identity.
            // eslint-disable-next-line react/no-array-index-key
            key={`${cellsBaseId}-${index}`}
            ref={(node) => {
              setCellRef(node, index);
            }}
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            // Only cell 1 advertises the autofill target so iOS Safari does not try to drop the
            // full code into every box — the paste handler distributes the digits across cells.
            autoComplete={index === 0 ? "one-time-code" : "off"}
            maxLength={1}
            value={char}
            disabled={disabled}
            aria-label={`Digit ${index + 1} of ${length}`}
            onChange={(event) => {
              writeAt(index, event.target.value);
            }}
            onKeyDown={(event) => {
              onKeyDown(event, index);
            }}
            onPaste={onPaste}
            className="text-center font-mono text-base"
          />
        ))}
      </div>
    </div>
  );
}
