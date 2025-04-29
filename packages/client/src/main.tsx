import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import Phaser from "phaser";
import { BootScene } from "./core/scenes/BootScene.ts";
import { GameScene } from "./core/scenes/GameScene.ts";
import { MainMenuScene } from "./core/scenes/MainMenuScene.ts"; // Import the new scene
import { Logger, LogLevel } from "@one-button-to-space/shared"; // Import Logger
import { run } from "./core/Game";
import { EventEmitter } from "./utils/EventEmitter"; // Import the EventEmitter

// -- Logging Setup --
// Create a set of sources to exclude
const blacklistSources = new Set<string>([
  "🧑‍🚀✨", // Player.ts
  "🌐", // NetworkManager.ts
]);

// Set log level to TRACE, but blacklist specific sources
Logger.setFilters(LogLevel.TRACE, undefined, blacklistSources);

// Logger Source for this file
const LOGGER_SOURCE = "🚀🎬";

// --- Create Global Event Emitter --- //
export const gameEmitter = new EventEmitter();

// Store the game instance reference
let gameInstance: Phaser.Game | null = null;

// Game configuration
const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: window.innerWidth,
  height: window.innerHeight,
  parent: "phaser-container", // ID of the div where the canvas will be injected
  physics: {
    default: "matter",
    matter: {
      debug: import.meta.env.DEV, // Enable debug drawing in development
      gravity: { x: 0, y: 0 },
      enableSleeping: true,
    },
  },
  scene: [BootScene, MainMenuScene, GameScene], // Added MainMenuScene
  scale: {
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  backgroundColor: "#1a1a1a",
};

// Function to initialize the game
function initGame() {
  if (gameInstance) {
    console.warn("Destroying existing Phaser game instance for HMR.");
    gameInstance.destroy(true); // true to remove canvas from DOM
    gameInstance = null;
  }
  gameInstance = new Phaser.Game(config);
  Logger.info(LOGGER_SOURCE, "Phaser Game instance created.");

  // Optional: Make game instance globally accessible for debugging
  if (import.meta.env.DEV) {
    (window as any).phaserGame = gameInstance;
    Logger.debug(
      LOGGER_SOURCE,
      "Phaser game instance attached to window for debugging."
    );
  }
}

// Initial game initialization
initGame();

// Mount the React application
// Check if root already exists to prevent React warning during HMR
const rootElement = document.getElementById("root");
if (rootElement) {
  // Basic check: if the element already has React internals, assume it's mounted.
  // A more robust check might involve a flag or checking rootElement._reactRootContainer
  if (!(rootElement as any)._reactRootContainer) {
    ReactDOM.createRoot(rootElement).render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    );
  } else {
    // If root exists, maybe just re-render App if needed (though StrictMode might remount)
    console.log("React root already exists, skipping createRoot.");
    // Potentially force-render App if state needs reset
    // ReactDOM.createRoot(rootElement).render(<React.StrictMode><App /></React.StrictMode>); // This might still cause issues
  }
} else {
  console.error("Root element #root not found");
}

// --- HMR Handling --- //
if (import.meta.hot) {
  import.meta.hot.accept(() => {
    // When this module or its dependencies are updated,
    // destroy the old game instance before the module re-runs.
    Logger.info(LOGGER_SOURCE, "HMR update detected. Destroying Phaser game.");
    if (gameInstance) {
      gameInstance.destroy(true);
      gameInstance = null;
    }
    // Note: The module re-execution will call initGame() again.
    // React HMR usually handles component updates well, but full module re-run
    // might still cause the React root warning if not careful.
    // The check above aims to mitigate the React warning.
  });

  // Optional: Dispose callback for more granular cleanup if needed
  // import.meta.hot.dispose(() => {
  //   Logger.info(LOGGER_SOURCE, "HMR disposing module. Cleaning up Phaser.");
  //   if (gameInstance) {
  //     gameInstance.destroy(true);
  //     gameInstance = null;
  //   }
  // });
}
