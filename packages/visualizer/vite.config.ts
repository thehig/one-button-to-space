import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@obts/shared": path.resolve(__dirname, "../shared/src"),
    },
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
});
