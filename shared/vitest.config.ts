/// <reference types="vitest" />
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true, // Use global APIs like describe, it, expect
    environment: "node", // Specify environment (node for shared lib)
    // Add other configurations as needed
    include: ["src/**/*.test.ts"], // Ensure test files are included
    // setupFiles: ['./src/tests/setup.ts'], // Optional setup file
  },
});
