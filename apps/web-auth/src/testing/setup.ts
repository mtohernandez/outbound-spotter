import "@testing-library/jest-dom/vitest";
import "@/testing/axe";

import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

// jsdom under vitest 4 ships an incomplete Storage on `window.localStorage` (prototype methods missing
// in some pool configs), so we install a minimal in-memory Storage that satisfies the contract.
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

if (typeof window.matchMedia === "undefined") {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    writable: true,
    value: vi.fn((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  document.documentElement.classList.remove("dark");
});
