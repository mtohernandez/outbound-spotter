import { useEffect, useId, useRef, useState } from "react";

import { scorePassword } from "../utils/password-strength";

import type { PasswordScore } from "../utils/password-rules";

interface Props {
  readonly value: string;
  readonly userInputs?: readonly string[];
  readonly onScoreChange?: ((score: PasswordScore) => void) | undefined;
}

interface Level {
  label: string;
  toneClass: string;
}

const LEVELS: Record<PasswordScore, Level> = {
  0: { label: "Too weak", toneClass: "bg-destructive" },
  1: { label: "Weak", toneClass: "bg-destructive" },
  2: { label: "Fair", toneClass: "bg-destructive" },
  3: { label: "Strong", toneClass: "bg-primary" },
  4: { label: "Very strong", toneClass: "bg-primary" },
};

const BAR_COUNT = 4;
const EMPTY_LABEL = "Enter a password to see strength";

export function PasswordStrengthMeter({
  value,
  userInputs,
  onScoreChange,
}: Props): React.ReactElement {
  const labelId = useId();
  const [score, setScore] = useState<PasswordScore>(0);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!value) return undefined;

    debounceRef.current = setTimeout(() => {
      void (async () => {
        const result = await scorePassword(value, [...(userInputs ?? [])]);
        const next = result.score;
        setScore(next);
        onScoreChange?.(next);
      })();
    }, 150);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [value, userInputs, onScoreChange]);

  const isEmpty = value.length === 0;
  const effectiveScore: PasswordScore = isEmpty ? 0 : score;
  const currentLevel = LEVELS[effectiveScore];
  const label = isEmpty ? EMPTY_LABEL : currentLevel.label;
  // Fill one bar per score point, all in the same tone so the user reads the meter as a single
  // progress indicator. Score 0 → 1 bar red so the user gets immediate feedback.
  const filledBars = isEmpty ? 0 : Math.max(1, effectiveScore);
  const toneClass = currentLevel.toneClass;

  return (
    <div aria-labelledby={labelId} className="flex flex-col gap-1.5">
      <div className="flex items-center gap-1">
        {Array.from({ length: BAR_COUNT }, (_, index) => {
          const filled = index < filledBars;
          return (
            <span
              key={index}
              data-filled={filled || undefined}
              className={`bg-muted h-1.5 flex-1 rounded-full ${filled ? toneClass : ""}`}
            />
          );
        })}
      </div>
      <p id={labelId} aria-live="polite" className="text-muted-foreground text-xs">
        {label}
      </p>
    </div>
  );
}
