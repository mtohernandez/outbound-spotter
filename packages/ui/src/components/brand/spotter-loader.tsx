import { useId, type SVGProps } from "react";

import { cn } from "../../lib/utils";

const SIZE_CLASSES = {
  sm: "size-4",
  md: "size-6",
  lg: "size-10",
} as const;

export type SpotterLoaderSize = keyof typeof SIZE_CLASSES;

export interface SpotterLoaderProps extends Omit<SVGProps<SVGSVGElement>, "fill" | "viewBox"> {
  size?: SpotterLoaderSize;
  "aria-label"?: string;
}

export function SpotterLoader({
  size = "md",
  className,
  "aria-label": ariaLabel = "Loading",
  ...svgProps
}: SpotterLoaderProps) {
  const rawId = useId();
  const scopeId = `spotter-${rawId.replace(/[^a-zA-Z0-9_-]/g, "")}`;

  return (
    <span
      role="status"
      aria-label={ariaLabel}
      className={cn("inline-block", SIZE_CLASSES[size], className)}
    >
      <style>{buildStyle(scopeId)}</style>
      <svg
        viewBox="0 0 195 128"
        xmlns="http://www.w3.org/2000/svg"
        className="size-full"
        aria-hidden
        {...svgProps}
      >
        <circle id={`${scopeId}-red`} cx="30.7181" cy="30.6654" r="30.7181" fill="var(--red-500)" />
        <circle
          id={`${scopeId}-teal`}
          cx="30.7181"
          cy="97.3314"
          r="30.7181"
          fill="var(--teal-600)"
        />
        <circle id={`${scopeId}-bm`} cx="97.4662" cy="97.3314" r="30.7181" fill="var(--teal-200)" />
        <circle id={`${scopeId}-br`} cx="164.235" cy="97.3314" r="30.7181" fill="var(--teal-200)" />
      </svg>
    </span>
  );
}

// Each circle traces the L-shape (TL → BL → BM → BR) over the first three quarters of the cycle,
// then holds at the fourth position for the final quarter. The cycle-boundary snap back to the
// starting position is instant (CSS does not interpolate between iterations), which avoids the
// diagonal teleport the previous keyframes showed during the 75% → 100% segment.
function buildStyle(scopeId: string): string {
  return `
@keyframes ${scopeId}-orbit-red {
  0%        { transform: translate(0, 0); }
  25%       { transform: translate(0, 66.666px); }
  50%       { transform: translate(66.748px, 66.666px); }
  75%, 100% { transform: translate(133.517px, 66.666px); }
}
@keyframes ${scopeId}-orbit-teal {
  0%        { transform: translate(0, 0); }
  25%       { transform: translate(66.748px, 0); }
  50%       { transform: translate(133.517px, 0); }
  75%, 100% { transform: translate(0, -66.666px); }
}
@keyframes ${scopeId}-orbit-bm {
  0%        { transform: translate(0, 0); }
  25%       { transform: translate(66.769px, 0); }
  50%       { transform: translate(-66.748px, -66.666px); }
  75%, 100% { transform: translate(-66.748px, 0); }
}
@keyframes ${scopeId}-orbit-br {
  0%        { transform: translate(0, 0); }
  25%       { transform: translate(-133.517px, -66.666px); }
  50%       { transform: translate(-133.517px, 0); }
  75%, 100% { transform: translate(-66.769px, 0); }
}
@media (prefers-reduced-motion: no-preference) {
  #${scopeId}-red,
  #${scopeId}-teal,
  #${scopeId}-bm,
  #${scopeId}-br {
    animation-duration: 1600ms;
    animation-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
    animation-iteration-count: infinite;
  }
  #${scopeId}-red  { animation-name: ${scopeId}-orbit-red; }
  #${scopeId}-teal { animation-name: ${scopeId}-orbit-teal; }
  #${scopeId}-bm   { animation-name: ${scopeId}-orbit-bm; }
  #${scopeId}-br   { animation-name: ${scopeId}-orbit-br; }
}
`;
}
