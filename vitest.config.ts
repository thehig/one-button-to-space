import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    workspace: ["packages/*"],
    exclude: [
      "node_modules",
      "dist",
      "build",
      "coverage",
      "**/DO_NOT_EDIT_THIS/**",
    ],
    coverage: {
      provider: "v8", // or 'istanbul'
      reporter: ["text", "json", "html"],
      reportsDirectory: "./coverage", // Output directory for the combined report

      exclude: [
        "node_modules",
        "dist",
        "build",
        "coverage",
        "**/DO_NOT_EDIT_THIS/**",
        "vitest.*",
        "**/*.config.*",
      ],
    },
  },
});
