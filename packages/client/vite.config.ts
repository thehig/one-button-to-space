import { defineConfig } from "vite";
import react from "@vitejs/plugin-react"; // Assuming React, remove/change if needed
import * as path from "path"; // Use namespace import for path

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // Alias the shared package to its source directory
      "@one-button-to-space/shared": path.resolve(__dirname, "../shared/src"),
    },
  },
  server: {
    host: true, // Make accessible on the network
  },
});
