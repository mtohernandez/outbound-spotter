import { render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AuthVideoPanel } from "./auth-video-panel";

type MediaListener = (event: MediaQueryListEvent) => void;

function mockMatchMedia(matches: boolean) {
  const listeners = new Set<MediaListener>();
  const addEventListener = vi.fn((_type: string, listener: MediaListener) => {
    listeners.add(listener);
  });
  const removeEventListener = vi.fn((_type: string, listener: MediaListener) => {
    listeners.delete(listener);
  });

  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    writable: true,
    value: vi.fn((query: string) => ({
      matches,
      media: query,
      onchange: null,
      addEventListener,
      removeEventListener,
      dispatchEvent: vi.fn(),
    })),
  });

  return { addEventListener, removeEventListener };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("AuthVideoPanel", () => {
  it("renders the autoplay video with desktop and mobile sources", () => {
    mockMatchMedia(false);

    const { container } = render(<AuthVideoPanel />);

    const video = container.querySelector("video");
    expect(video).not.toBeNull();
    expect(video?.autoplay).toBe(true);
    expect(video?.muted).toBe(true);
    expect(video?.loop).toBe(true);
    expect(video?.playsInline).toBe(true);
    expect(video?.getAttribute("poster")).toBe("/auth/video-poster.jpg");

    const sources = container.querySelectorAll("source");
    expect(sources).toHaveLength(2);
    expect(sources[0]?.getAttribute("src")).toBe("/auth/video-desktop.mp4");
    expect(sources[0]?.getAttribute("media")).toBe("(min-width: 1024px)");
    expect(sources[1]?.getAttribute("src")).toBe("/auth/video-mobile.mp4");
  });

  it("renders the poster image when prefers-reduced-motion is set", () => {
    mockMatchMedia(true);

    const { container } = render(<AuthVideoPanel />);

    expect(container.querySelector("video")).toBeNull();
    const poster = container.querySelector('img[src="/auth/video-poster.jpg"]');
    expect(poster).not.toBeNull();
    expect(poster).toHaveAttribute("aria-hidden", "true");
  });

  it("subscribes to the prefers-reduced-motion change event and unsubscribes on unmount", () => {
    const { addEventListener, removeEventListener } = mockMatchMedia(false);

    const { unmount } = render(<AuthVideoPanel />);

    expect(addEventListener).toHaveBeenCalledWith("change", expect.any(Function));
    unmount();
    expect(removeEventListener).toHaveBeenCalledWith("change", expect.any(Function));
  });
});
