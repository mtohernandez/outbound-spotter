import { useEffect, useId, useRef, useState } from "react";

import { scorePassword, type PasswordScore } from "../utils/password-rules";

interface Props {
  readonly value: string;
  readonly userInputs?: readonly string[];
  readonly onScoreChange?: ((score: PasswordScore) => void) | undefined;
}

const LEVELS: { score: PasswordScore; label: string; toneClass: string }[] = [
  { score: 0, label: "Too weak", toneClass: "bg-destructive" },
  { score: 1, label: "Weak", toneClass: "bg-destructive" },
  { score: 2, label: "Fair", toneClass: "bg-chart-2" },
  { score: 3, label: "Strong", toneClass: "bg-primary" },
  { score: 4, label: "Very strong", toneClass: "bg-primary" },
];

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
  const label = isEmpty ? EMPTY_LABEL : (LEVELS[effectiveScore]?.label ?? EMPTY_LABEL);

  return (
    <div aria-labelledby={labelId} className="flex flex-col gap-1.5">
      <div className="flex items-center gap-1">
        {LEVELS.slice(1).map((level, index) => {
          const filled = !isEmpty && index < effectiveScore;
          return (
            <span
              key={level.score}
              data-filled={filled || undefined}
              className={`bg-muted h-1.5 flex-1 rounded-full ${filled ? level.toneClass : ""}`}
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
