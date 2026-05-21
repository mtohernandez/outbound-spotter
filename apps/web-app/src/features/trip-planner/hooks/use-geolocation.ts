import { useCallback, useState } from "react";

// US bounding box per spec 11b Decision 10. Continental + Alaska up to 71° N,
// Aleutians to Maine, Hawaii (~ -160 to -154 lon) and Puerto Rico (~ -67 to -65)
// fall inside.
const US_LAT_MIN = 24;
const US_LAT_MAX = 71;
const US_LON_MIN = -180;
const US_LON_MAX = -66;
const TIMEOUT_MS = 5000;
const MAX_AGE_MS = 60_000;

export type GeolocationStatus =
  | "idle"
  | "pending"
  | "success"
  | "denied"
  | "outside-us"
  | "timeout"
  | "unavailable"
  | "unsupported";

export interface Coordinates {
  readonly lat: number;
  readonly lon: number;
}

export interface GeolocationState {
  readonly status: GeolocationStatus;
  readonly coords: Coordinates | null;
  readonly error: Error | null;
  readonly request: () => Promise<Coordinates | null>;
}

function isInsideUs(lat: number, lon: number): boolean {
  return lat >= US_LAT_MIN && lat <= US_LAT_MAX && lon >= US_LON_MIN && lon <= US_LON_MAX;
}

export function useGeolocation(): GeolocationState {
  const [status, setStatus] = useState<GeolocationStatus>("idle");
  const [coords, setCoords] = useState<Coordinates | null>(null);
  const [error, setError] = useState<Error | null>(null);

  const request = useCallback(async (): Promise<Coordinates | null> => {
    // Modern browsers always expose `navigator.geolocation`, but TypeScript
    // 6's `lib.dom` already types `navigator` as non-nullable; the runtime
    // probe stays as a defensive belt-and-suspenders fallback for embedded
    // contexts (e.g., Apple-iframe content scripts).
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- runtime guard
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setStatus("unsupported");
      const err = new Error("Geolocation is not available in this browser.");
      setError(err);
      return null;
    }

    setStatus("pending");
    setError(null);

    return new Promise<Coordinates | null>((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const lat = position.coords.latitude;
          const lon = position.coords.longitude;
          if (!isInsideUs(lat, lon)) {
            setStatus("outside-us");
            setCoords(null);
            const err = new Error("Outside the US — please type an address manually.");
            setError(err);
            resolve(null);
            return;
          }
          const result: Coordinates = { lat, lon };
          setCoords(result);
          setStatus("success");
          resolve(result);
        },
        (positionError) => {
          // Map browser error codes to discriminable statuses; the
          // PositionError constants are stable across browsers.
          const mapped: GeolocationStatus =
            positionError.code === positionError.PERMISSION_DENIED
              ? "denied"
              : positionError.code === positionError.TIMEOUT
                ? "timeout"
                : "unavailable";
          setStatus(mapped);
          const err = new Error(positionError.message || mapped);
          setError(err);
          resolve(null);
        },
        {
          enableHighAccuracy: false,
          timeout: TIMEOUT_MS,
          maximumAge: MAX_AGE_MS,
        },
      );
    });
  }, []);

  return { status, coords, error, request };
}
