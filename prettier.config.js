/** @type {import("prettier").Config} */
const config = {
  semi: true,
  singleQuote: false,
  trailingComma: "all",
  printWidth: 100,
  tabWidth: 2,
  useTabs: false,
  bracketSpacing: true,
  bracketSameLine: false,
  arrowParens: "always",
  endOfLine: "lf",
  proseWrap: "preserve",
  plugins: ["prettier-plugin-tailwindcss"],
  tailwindFunctions: ["cn", "clsx", "cva", "tw"],
  overrides: [
    {
      files: ["*.md", "*.mdx"],
      options: { printWidth: 120 },
    },
    {
      files: ["*.yml", "*.yaml"],
      options: { singleQuote: true },
    },
  ],
};

export default config;
