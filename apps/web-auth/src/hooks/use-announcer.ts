import { useCallback, useState } from "react";

interface Announcer {
  readonly message: string;
  readonly announce: (text: string) => void;
  readonly clear: () => void;
}

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
