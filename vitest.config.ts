import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    coverage: {
      provider: "v8", // or 'istanbul'
      reporter: ["text", "json", "html"],
      reportsDirectory: "./coverage", // Output directory for the combined report
    },
  },
});
