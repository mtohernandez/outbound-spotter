import { useEffect, useState } from "react";

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

function readPrefersReducedMotion(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
  return window.matchMedia(REDUCED_MOTION_QUERY).matches;
}

export function AuthVideoPanel(): React.ReactElement {
  const [reducedMotion, setReducedMotion] = useState<boolean>(readPrefersReducedMotion);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return undefined;
    const media = window.matchMedia(REDUCED_MOTION_QUERY);
    const onChange = (event: MediaQueryListEvent) => {
      setReducedMotion(event.matches);
    };
    media.addEventListener("change", onChange);
    return () => {
      media.removeEventListener("change", onChange);
    };
  }, []);

  return (
    <aside
      aria-hidden="true"
      className="bg-card text-card-foreground border-border relative hidden h-full overflow-hidden rounded-xl border shadow-lg md:block"
    >
      {reducedMotion ? (
        <img
          src="/auth/video-poster.jpg"
          alt=""
          aria-hidden="true"
          fetchPriority="high"
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : (
        <video
          aria-hidden="true"
          autoPlay
          muted
          playsInline
          loop
          preload="metadata"
          poster="/auth/video-poster.jpg"
          className="absolute inset-0 h-full w-full object-cover"
        >
          <source media="(min-width: 1024px)" src="/auth/video-desktop.mp4" type="video/mp4" />
          <source src="/auth/video-mobile.mp4" type="video/mp4" />
        </video>
      )}
      <div
        aria-hidden
        className="absolute inset-x-0 bottom-0 bg-linear-to-t from-black/80 via-black/30 to-transparent p-6 lg:p-8"
      >
        <h2 className="font-display text-2xl text-white">Drive smarter. Stay compliant.</h2>
        <p className="font-sans text-sm text-white/90">
          Plan HOS-aware routes and generate FMCSA-ready logs in seconds.
        </p>
      </div>
    </aside>
  );
}
