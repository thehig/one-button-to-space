import globals from "globals";
import tsParser from "@typescript-eslint/parser";
import tsPlugin from "@typescript-eslint/eslint-plugin";
import eslint from "@eslint/js"; // Import recommended config
import vitestPlugin from "eslint-plugin-vitest";

export default [
  // Apply recommended rules globally (for JS files if any)
  eslint.configs.recommended,
  {
    // Target TypeScript/TSX files (excluding tests for now)
    files: ["src/**/*.ts", "src/**/*.tsx"],
    // Apply general TS rules to non-test files first
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        project: true, // Use tsconfig.json in the same directory
        tsconfigRootDir: import.meta.dirname,
      },
      globals: {
        ...globals.browser,
        ...globals.node,
        ...globals.es2020,
      },
    },
    plugins: {
      "@typescript-eslint": tsPlugin,
    },
    rules: {
      ...tsPlugin.configs.recommended.rules,
      // Add any project-specific rule overrides here
    },
  },
  {
    // Configuration specifically for test files
    files: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    plugins: {
      vitest: vitestPlugin,
      "@typescript-eslint": tsPlugin, // Keep TS plugin for test files too
    },
    languageOptions: {
      parser: tsParser, // Still use TS parser
      parserOptions: {
        project: true,
        tsconfigRootDir: import.meta.dirname,
      },
      globals: {
        ...globals.browser,
        ...globals.node,
        ...globals.es2020,
        ...vitestPlugin.environments.env.globals, // Add Vitest globals
      },
    },
    rules: {
      // Apply base TS recommended rules
      ...tsPlugin.configs.recommended.rules,
      // Apply Vitest recommended rules
      ...vitestPlugin.configs.recommended.rules,
      // Override/add specific rules for tests if needed
      // e.g., allow any type in tests if necessary, though best avoided
      // "@typescript-eslint/no-explicit-any": "off",
    },
  },
  {
    // Ignore node_modules, dist, etc.
    ignores: [
      "node_modules/**",
      "dist/**",
      "coverage/**",
      "vitest.config.ts",
      "eslint.config.js",
    ],
  },
];
