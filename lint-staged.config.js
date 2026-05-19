/** @type {import("lint-staged").Configuration} */
const config = {
  "**/*.{ts,tsx,js,jsx,mjs,cjs}": [
    "eslint --fix --max-warnings=0 --no-warn-ignored",
    "prettier --write",
  ],
  "**/*.{json,yml,yaml,md,mdx,css}": ["prettier --write"],
  "**/*.py": (files) => {
    if (files.length === 0) return [];
    // Quote each path so spaces in the absolute path don't split args.
    const quoted = files.map((f) => `"${f}"`).join(" ");
    return [`uvx ruff check --fix --quiet ${quoted}`, `uvx ruff format --quiet ${quoted}`];
  },
};

export default config;
