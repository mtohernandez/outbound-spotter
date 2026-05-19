import { reactConfig } from "@outbound/eslint-config/react";

export default [
  ...reactConfig,
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    // shadcn-generated primitives are CLI-owned (regenerate via `shadcn add`),
    // so we relax the rules that fight canonical shadcn output instead of patching the files.
    files: ["src/components/ui/**/*.{ts,tsx}"],
    rules: {
      "import-x/order": "off",
      "react-refresh/only-export-components": "off",
      "@typescript-eslint/consistent-type-definitions": "off",
      "@typescript-eslint/no-unnecessary-condition": "off",
      "@typescript-eslint/no-unnecessary-template-expression": "off",
      "@typescript-eslint/no-unnecessary-type-conversion": "off",
    },
  },
];
