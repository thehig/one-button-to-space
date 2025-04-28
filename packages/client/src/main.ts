// console.log("MAIN.TS EXECUTING");
import "./style.css";
import Phaser from "phaser";
import { MainScene } from "./game/scenes/MainScene";
// import { PreloadScene } from './game/scenes/PreloadScene'; // Remove this line
// Import the Logger instance and LogLevel enum
import { Logger, LogLevel } from "@one-button-to-space/shared"; // Corrected import path

// Set the Logger level and blacklist the DeviceOrientationManager
const blacklistedSources = new Set<string>([
  "🧭📱", // DeviceOrientationManager
]);
Logger.setFilters(LogLevel.TRACE, undefined, blacklistedSources); // Pass undefined for allowlist to keep default behavior

Logger.info("🚀", "Application main entry point reached.");

// Define the source constant for logging
const LOGGER_SOURCE = "🚀🏁"; // Chosen emojis for main entry point

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: "game-container",
  backgroundColor: "#000000", // Explicitly set background color
  scale: {
    mode: Phaser.Scale.RESIZE, // Resize game to fit parent
    autoCenter: Phaser.Scale.CENTER_BOTH, // Center the game canvas
  },
  physics: {
    default: "matter", // Use Matter.js physics
    matter: {
      debug: true, // Enable debug drawing
      enableSleeping: true,
      gravity: {
        x: 0,
        y: 0,
      },
    },
  },
  scene: [
    MainScene, // Add our main scene here
  ],
};

// Instantiate the game directly
const game = new Phaser.Game(config);
Logger.debug(LOGGER_SOURCE, "Phaser game instance created:", game); // Re-enabled as debug log

// Vite HMR cleanup
if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    Logger.info(LOGGER_SOURCE, "Destroying previous Phaser game instance...");
    game.destroy(true); // Pass true to remove the canvas element
  });
}
