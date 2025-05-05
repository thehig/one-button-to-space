import globals from "globals";
import tsParser from "@typescript-eslint/parser";
import tsPlugin from "@typescript-eslint/eslint-plugin";
import eslint from "@eslint/js"; // Import recommended config

export default [
  // Apply recommended rules globally (for JS files if any)
  eslint.configs.recommended,
  {
    // Target TypeScript/TSX files
    files: ["**/*.ts", "**/*.tsx"],

    // Language options specific to TS/TSX
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

    // TypeScript specific plugin and rules *within the same object*
    plugins: {
      // Use a key that matches the plugin name expected by the rules (e.g., '@typescript-eslint')
      // Or map it explicitly if the ruleset doesn't assume the key.
      // Often, simply using 'typescript' as the key works if the plugin is referenced that way internally.
      // Let's try 'typescript' first, as used before.
      // typescript: tsPlugin, // Didn't work
      // If issues persist, try '@typescript-eslint': tsPlugin,
      "@typescript-eslint": tsPlugin,
    },

    // Extend recommended TypeScript rules
    rules: {
      // Base JS recommended rules apply from the global config above
      // Apply TS recommended rules
      ...tsPlugin.configs.recommended.rules,
      // Add any project-specific rule overrides here
      // e.g., "typescript/no-explicit-any": "warn"
    },
  },
  {
    // Ignore node_modules, dist, etc.
    ignores: ["node_modules/**", "dist/**", "coverage/**", "vitest.config.ts"],
  },
];
