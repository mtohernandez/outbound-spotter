import { useCallback, useState } from "react";

interface Announcer {
  readonly message: string;
  readonly announce: (text: string) => void;
  readonly clear: () => void;
}

// A polite-live-region announcer that survives identical consecutive announcements. React's
// `useState` bails on `Object.is`-equal values, so calling `setMessage("X")` twice with the
// same string never re-renders, and screen readers never re-announce. We work around that by
// clearing first and re-applying on the next frame: AT observes the "" → "X" transition every
// time, which is what `aria-live="polite"` needs to fire.
export function useAnnouncer(): Announcer {
  const [message, setMessage] = useState("");

  const announce = useCallback((text: string) => {
    setMessage("");
    if (!text) return;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setMessage(text);
      });
    });
  }, []);

  const clear = useCallback(() => {
    setMessage("");
  }, []);

  return { message, announce, clear };
}
