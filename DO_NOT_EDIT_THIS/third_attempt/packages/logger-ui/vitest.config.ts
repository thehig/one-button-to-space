import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    globals: true, // Explicitly enable globals just in case
    setupFiles: ["./src/setupTests.ts"],
    coverage: {
      provider: "v8", // Assuming v8, change if needed
      exclude: [
        "**/index.ts", // Exclude all index.ts files
        "**/types.ts", // Also exclude the main types file
        "src/mocks/**", // Exclude the mocks directory
        "**/*.config.ts",
        "**/*.config.js",
        "**/global.d.ts",
        // Add other patterns if needed, e.g., specific config files
      ],
      // Optional: Configure reporters, thresholds etc.
      // reporter: ['text', 'json', 'html'],
    },
  },
});
