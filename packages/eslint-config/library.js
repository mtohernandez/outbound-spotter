/**
 * Outbound Spotter — TS library ESLint flat config.
 *
 * For shared packages (packages/*) that emit declarations.
 * Same as base but allows default exports (libs often expose a primary symbol).
 */
import { base } from "./base.js";

export const library = [
  ...base,
  {
    files: ["src/**/*.{ts,tsx}"],
    rules: {
      "import-x/no-default-export": "off",
    },
  },
];

export default library;
