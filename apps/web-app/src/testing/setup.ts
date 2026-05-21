import "@testing-library/jest-dom/vitest";

import { cleanup } from "@testing-library/react";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, vi } from "vitest";

import { handlers } from "@/testing/handlers";

// jsdom 29 doesn't ship IntersectionObserver or ResizeObserver — cmdk's command
// menu and Radix popover both reach for them. Mirror the localStorage shim
// pattern from packages/ui/src/test/setup.ts.
const noop = (): void => undefined;

class MockIntersectionObserver {
  readonly observe = noop;
  readonly unobserve = noop;
  readonly disconnect = noop;
  readonly takeRecords = (): IntersectionObserverEntry[] => [];
}

class MockResizeObserver {
  readonly observe = noop;
  readonly unobserve = noop;
  readonly disconnect = noop;
}

if (typeof globalThis.IntersectionObserver === "undefined") {
  Object.defineProperty(globalThis, "IntersectionObserver", {
    configurable: true,
    writable: true,
    value: MockIntersectionObserver,
  });
}

if (typeof globalThis.ResizeObserver === "undefined") {
  Object.defineProperty(globalThis, "ResizeObserver", {
    configurable: true,
    writable: true,
    value: MockResizeObserver,
  });
}

// jsdom under vitest 4 ships an incomplete Storage prototype in some pool
// configurations (setItem/getItem missing). Match the packages/ui +
// apps/web-auth shim so test code can interact with localStorage normally.
class MemoryStorage implements Storage {
  #store = new Map<string, string>();

  get length(): number {
    return this.#store.size;
  }

  key(index: number): string | null {
    return [...this.#store.keys()][index] ?? null;
  }

  getItem(key: string): string | null {
    return this.#store.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.#store.set(key, value);
  }

  removeItem(key: string): void {
    this.#store.delete(key);
  }

  clear(): void {
    this.#store.clear();
  }
}

Object.defineProperty(window, "localStorage", {
  configurable: true,
  writable: true,
  value: new MemoryStorage(),
});

if (typeof window !== "undefined") {
  if (typeof window.matchMedia === "undefined") {
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));
  }
  if (typeof Element.prototype.scrollIntoView === "undefined") {
    Element.prototype.scrollIntoView = vi.fn();
  }
  if (typeof window.HTMLElement.prototype.hasPointerCapture === "undefined") {
    window.HTMLElement.prototype.hasPointerCapture = (): boolean => false;
    window.HTMLElement.prototype.releasePointerCapture = (): void => {
      // no-op for jsdom
    };
  }
}

export const server = setupServer(...handlers);

beforeAll(() => {
  server.listen({ onUnhandledRequest: "error" });
});

afterEach(() => {
  cleanup();
  server.resetHandlers();
});

afterAll(() => {
  server.close();
});
