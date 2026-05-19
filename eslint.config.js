import { base } from "@outbound/eslint-config/base";

export default [
  ...base,
  {
    ignores: ["apps/**", "packages/**", "docs/**", "context/**", ".agents/**", ".claude/**"],
  },
];
