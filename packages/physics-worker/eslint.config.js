import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist", "node_modules", "coverage"] },
  // Configuration for TypeScript files in src
  {
    files: ["src/**/*.ts"], // Only TS files now
    languageOptions: {
      ecmaVersion: 2020,
      globals: {
        ...globals.worker,
        ...globals.es2020,
        ...globals.browser, // Kept browser globals as tests under src might still benefit
      },
      parser: tseslint.parser,
      parserOptions: {
        project: "./tsconfig.json",
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: {
      "@typescript-eslint": tseslint.plugin,
    },
    rules: {
      ...js.configs.recommended.rules,
      ...tseslint.configs.recommended.rules,
      ...tseslint.configs.strict.rules,
      "no-unused-vars": "off",
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
          ignoreRestSiblings: true,
        },
      ],
    },
  },
  // Configuration for JavaScript files in demos
  {
    files: ["demos/**/*.js"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: {
        ...globals.browser, // Demos run in browser
        ...globals.es2020,
      },
      // For JS files, we don't need the TS parser with project reference
      // We can use the default parser or tseslint.parser without project options
      // Using tseslint.parser here for consistency if you might use some @typescript-eslint rules
      // that are JS-compatible, but without project-specifics.
      parser: tseslint.parser,
      parserOptions: {
        ecmaVersion: 2020,
        sourceType: "module", // Assuming demos use ES modules
      },
    },
    plugins: {
      // No need for @typescript-eslint plugin here if not using its specific rules heavily on JS
      // If you do, you can add it back.
    },
    rules: {
      ...js.configs.recommended.rules,
      // Add any JS-specific rules for demos here
      "no-unused-vars": ["warn", { argsIgnorePattern: "^_" }], // Example: warn for unused vars
    },
  }
);
