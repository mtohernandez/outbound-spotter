import { toHaveNoViolations } from "jest-axe";
import { expect } from "vitest";

// Register the jest-axe matcher with Vitest's `expect`. Importing this file
// from `setup.ts` makes `toHaveNoViolations` available across every test
// suite without per-file boilerplate.
expect.extend(toHaveNoViolations);
