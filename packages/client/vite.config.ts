import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // Define global constants for Phaser
  define: {
    "typeof CANVAS_RENDERER": JSON.stringify(true),
    "typeof WEBGL_RENDERER": JSON.stringify(true),
    "typeof EXPERIMENTAL": JSON.stringify(true),
    "typeof PLUGIN_3D": JSON.stringify(false),
    "typeof PLUGIN_CAMERA3D": JSON.stringify(false),
    "typeof PLUGIN_FBINSTANT": JSON.stringify(false),
    "typeof FEATURE_SOUND": JSON.stringify(true),
  },
  build: {
    // Optimize build output (optional)
    // chunkSizeWarningLimit: 1000,
  },
  server: {
    // Configure server behavior (optional)
    // host: '0.0.0.0', // Make accessible on local network
    // port: 3000,
  },
});
