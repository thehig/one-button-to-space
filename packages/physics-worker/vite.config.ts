import { defineConfig } from "vite";
import path from "path";

export default defineConfig({
  // The root of the project for Vite will be the physics-worker package directory itself.
  root: ".",
  server: {
    open: "/demos/basic-test.html", // Automatically open the demo page
    port: 3001, // Use a specific port to avoid conflicts
  },
  build: {
    // This build config is for when you run `vite build` for this specific Vite setup.
    // It's separate from the `tsc` build that outputs to `dist/` for the library.
    // For the demo, we might not even need a separate Vite build step if it's just for dev.
    outDir: "dist-demo", // Output to a different directory to avoid conflicts
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, "demos/basic-test.html"),
      },
    },
  },
  // Ensure worker assets are handled correctly (Vite usually does this well by default)
  // worker: {
  //   format: 'es',
  // },
});
