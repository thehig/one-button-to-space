import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist", "node_modules", "coverage", "demos", "tests"] },
  // Base configuration for TypeScript files in src
  {
    files: ["src/**/*.ts"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: {
        ...globals.worker,
        ...globals.es2020,
      },
      parser: tseslint.parser, // Explicitly set the parser
      parserOptions: {
        project: "./tsconfig.json",
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: {
      "@typescript-eslint": tseslint.plugin, // Standard way to register the plugin
    },
    rules: {
      // Start with recommended rules
      ...js.configs.recommended.rules,
      ...tseslint.configs.recommended.rules, // General TS rules
      ...tseslint.configs.strict.rules, // Stricter TS rules (optional, but good)
      // ...tseslint.configs.stylistic.rules, // Stylistic TS rules (optional)

      // Disable base ESLint rule and enable TypeScript-specific one
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

      // Add any specific rule overrides or new rules here
      // e.g., '@typescript-eslint/no-explicit-any': 'warn',
    },
  }
  // Optional: Configuration for test files etc. can be added as separate objects in the array
);
