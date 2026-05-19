/**
 * Root ESLint config. Lints repo-level scripts and config files.
 * Each app and package brings its own `eslint.config.js` extending
 * the appropriate preset from `@outbound/eslint-config`.
 */
import { base } from "@outbound/eslint-config/base";

export default [
  ...base,
  {
    ignores: ["apps/**", "packages/**", "docs/**", "context/**", ".agents/**", ".claude/**"],
  },
];
