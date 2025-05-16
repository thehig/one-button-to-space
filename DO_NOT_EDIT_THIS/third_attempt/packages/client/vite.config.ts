import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Remove build options for multiple entry points if no longer needed
  /* Commenting out, assuming only one entry point now
  build: {
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, 'index.html'),
        // Remove logger entry
        // logger: path.resolve(__dirname, 'public/logger.html')
      }
    }
  }
  */
});
