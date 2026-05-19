/**
 * Outbound Spotter — base ESLint flat config.
 *
 * Universal rules for any TS/JS file in the monorepo:
 * - typescript-eslint strict-type-checked (TS files only)
 * - import-x ordering + no-cycles
 * - check-file kebab-case enforcement (per code-standards.md)
 * - unicorn modern-JS rules
 * - prettier conflict resolution (must be LAST)
 *
 * Consumers extend this and add their own per-environment rules.
 */
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import importX from "eslint-plugin-import-x";
import checkFile from "eslint-plugin-check-file";
import unicorn from "eslint-plugin-unicorn";
import prettier from "eslint-config-prettier";
import globals from "globals";

const IGNORES = [
  "**/dist/**",
  "**/build/**",
  "**/.next/**",
  "**/coverage/**",
  "**/node_modules/**",
  "**/.turbo/**",
  "**/.cache/**",
  "**/*.generated.*",
  "**/.agents/**",
  "**/.claude/**",
];

export const base = tseslint.config(
  { ignores: IGNORES },

  // JS recommended
  js.configs.recommended,

  // TS strict + stylistic (type-checked) — applies to all files, disabled below for JS
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,

  // Shared language + plugin defaults
  {
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: "module",
      globals: { ...globals.node, ...globals.es2024 },
      parserOptions: {
        projectService: true,
        tsconfigRootDir: process.cwd(),
      },
    },
    plugins: {
      "import-x": importX,
      "check-file": checkFile,
      unicorn,
    },
    rules: {
      // TypeScript hygiene
      "@typescript-eslint/consistent-type-imports": [
        "error",
        { prefer: "type-imports", fixStyle: "separate-type-imports" },
      ],
      "@typescript-eslint/no-import-type-side-effects": "error",
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          args: "all",
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-non-null-assertion": "error",
      "@typescript-eslint/explicit-module-boundary-types": "off",
      "@typescript-eslint/no-unnecessary-condition": "warn",
      "@typescript-eslint/restrict-template-expressions": [
        "error",
        { allowNumber: true, allowBoolean: true },
      ],
      "@typescript-eslint/switch-exhaustiveness-check": "error",

      // Imports
      "import-x/order": [
        "error",
        {
          groups: ["builtin", "external", "internal", "parent", "sibling", "index", "type"],
          "newlines-between": "always",
          alphabetize: { order: "asc", caseInsensitive: true },
          pathGroups: [
            { pattern: "@outbound/**", group: "internal", position: "before" },
            { pattern: "@/**", group: "internal", position: "after" },
          ],
        },
      ],
      "import-x/no-cycle": ["error", { maxDepth: 5, ignoreExternal: true }],
      "import-x/no-self-import": "error",
      "import-x/no-useless-path-segments": "error",
      "import-x/first": "error",
      "import-x/newline-after-import": "error",
      "import-x/no-default-export": "off",
      "import-x/no-duplicates": "error",

      // File naming (matches context/code-standards.md)
      "check-file/filename-naming-convention": [
        "error",
        {
          "**/*.{js,ts,jsx,tsx}": "KEBAB_CASE",
        },
        { ignoreMiddleExtensions: true },
      ],
      "check-file/folder-naming-convention": [
        "error",
        {
          "src/**/!(__tests__|__mocks__|__fixtures__)": "KEBAB_CASE",
        },
      ],

      // Modern JS
      "unicorn/prefer-node-protocol": "error",
      "unicorn/prefer-module": "error",
      "unicorn/no-array-for-each": "off",
      "unicorn/no-null": "off",
      "unicorn/prevent-abbreviations": "off",
      "unicorn/filename-case": "off", // delegated to check-file
      "unicorn/no-array-reduce": "off",

      // Misc
      "no-console": ["warn", { allow: ["warn", "error", "info"] }],
      "no-debugger": "error",
      eqeqeq: ["error", "always", { null: "ignore" }],
      curly: ["error", "all"],
      "prefer-const": "error",
      "no-var": "error",
      "object-shorthand": "error",
    },
  },

  // Plain JS / config / script files — disable type-checked rules so they
  // don't need a TS project.
  {
    files: ["**/*.{js,mjs,cjs}"],
    extends: [tseslint.configs.disableTypeChecked],
    languageOptions: {
      parserOptions: { projectService: false, project: null },
    },
    rules: {
      "@typescript-eslint/no-unsafe-assignment": "off",
      "@typescript-eslint/no-unsafe-call": "off",
      "@typescript-eslint/no-unsafe-member-access": "off",
      "@typescript-eslint/no-unsafe-argument": "off",
      "@typescript-eslint/no-explicit-any": "off",
      "import-x/no-default-export": "off",
    },
  },

  // Test files relax some rules
  {
    files: ["**/*.test.{ts,tsx,js,jsx}", "**/__tests__/**", "**/testing/**"],
    rules: {
      "@typescript-eslint/no-non-null-assertion": "off",
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unsafe-assignment": "off",
      "no-console": "off",
    },
  },

  // Prettier MUST be last to disable conflicting rules
  prettier,
);

export default base;
