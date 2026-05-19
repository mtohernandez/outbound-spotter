/**
 * Module declarations for the plain-JS subpath exports.
 * Keeps the IDE happy when consumers import these in TypeScript-aware
 * environments. The configs themselves are unstructured ESLint flat-config arrays.
 */
import type { Linter } from "eslint";

declare module "@outbound/eslint-config/base" {
  export const base: Linter.Config[];
  const config: Linter.Config[];
  export default config;
}

declare module "@outbound/eslint-config/react" {
  export const reactConfig: Linter.Config[];
  const config: Linter.Config[];
  export default config;
}

declare module "@outbound/eslint-config/library" {
  export const library: Linter.Config[];
  const config: Linter.Config[];
  export default config;
}
