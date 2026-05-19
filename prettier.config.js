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
  // prettier-plugin-tailwindcss reads tailwind config from each app independently.
  // The plugin auto-discovers the closest tailwind config / @theme block.
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
