/**
 * Outbound Spotter — React ESLint flat config.
 *
 * Extends base + adds:
 * - react / react-hooks / react-refresh (Vite HMR)
 * - jsx-a11y (WCAG 2.2 surface)
 * - Bulletproof React import-direction rules (shared → features → app)
 *   See: context/code-standards.md and https://github.com/alan2207/bulletproof-react
 */
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import jsxA11y from "eslint-plugin-jsx-a11y";
import globals from "globals";

import { base } from "./base.js";

/**
 * Bulletproof React `no-restricted-paths` zones.
 * Lower layers cannot import from higher layers. Features may not import siblings.
 */
const BULLETPROOF_ZONES = [
  // Shared modules cannot import from features or app
  {
    target: "./src/components",
    from: ["./src/features", "./src/app"],
  },
  {
    target: "./src/hooks",
    from: ["./src/features", "./src/app"],
  },
  {
    target: "./src/lib",
    from: ["./src/features", "./src/app"],
  },
  {
    target: "./src/types",
    from: ["./src/features", "./src/app"],
  },
  {
    target: "./src/utils",
    from: ["./src/features", "./src/app"],
  },
  {
    target: "./src/stores",
    from: ["./src/features", "./src/app"],
  },
  {
    target: "./src/config",
    from: ["./src/features", "./src/app"],
  },
  // Features cannot import from app
  {
    target: "./src/features",
    from: "./src/app",
  },
];

export const reactConfig = [
  ...base,

  // React rules apply to JS/TS/JSX/TSX in src and app dirs
  {
    files: ["src/**/*.{ts,tsx,js,jsx}", "app/**/*.{ts,tsx,js,jsx}"],
    languageOptions: {
      globals: { ...globals.browser, ...globals.es2024 },
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
    plugins: {
      react,
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
      "jsx-a11y": jsxA11y,
    },
    settings: {
      react: { version: "detect" },
      "import-x/resolver": {
        typescript: { alwaysTryTypes: true },
      },
    },
    rules: {
      ...react.configs.recommended.rules,
      ...react.configs["jsx-runtime"].rules,
      ...reactHooks.configs["recommended-latest"].rules,
      ...jsxA11y.flatConfigs.recommended.rules,

      // React 19 conventions
      "react/prop-types": "off",
      "react/react-in-jsx-scope": "off",
      "react/jsx-uses-react": "off",
      "react/jsx-no-leaked-render": "error",
      "react/jsx-curly-brace-presence": ["error", { props: "never", children: "never" }],
      "react/self-closing-comp": "error",
      "react/no-array-index-key": "warn",
      "react/no-unstable-nested-components": "error",

      // Vite HMR boundary
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],

      // Bulletproof React import zones
      "import-x/no-restricted-paths": ["error", { zones: BULLETPROOF_ZONES }],
    },
  },

  // Cross-feature import restriction — apps fill in their actual features
  // via an extension config. We DO restrict the parent-feature folder here.
  {
    files: ["src/features/*/**/*.{ts,tsx,js,jsx}"],
    rules: {
      // Features may not import from sibling features. The actual `except`
      // list (the current feature's name) is computed in each app's
      // eslint.config.js — see the README for the snippet.
      "import-x/no-restricted-paths": [
        "error",
        {
          zones: [
            ...BULLETPROOF_ZONES,
            {
              target: "./src/features",
              from: "./src/features",
              message:
                "Features may not import from sibling features. Lift the shared code to src/components, src/hooks, src/lib, or a packages/* workspace.",
            },
          ],
        },
      ],
    },
  },
];

export default reactConfig;
