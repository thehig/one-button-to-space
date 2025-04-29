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
import { SceneManager } from "./managers/SceneManager"; // Corrected Import SceneManager
import { EntityManager } from "./managers/EntityManager"; // Import EntityManager

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

// Store the game instance and React root references
let gameInstance: Phaser.Game | null = null;
let reactRoot: ReactDOM.Root | null = null; // Store the React root

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

// Function to initialize or re-initialize the game
function initGame() {
  // Destroy existing game instance if it exists (for HMR)
  if (gameInstance) {
    Logger.info(
      LOGGER_SOURCE,
      "Destroying existing Phaser game instance for HMR."
    );
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

// Function to initialize or update the React app
function renderApp() {
  Logger.debug(LOGGER_SOURCE, "renderApp() called");
  const rootElement = document.getElementById("root");
  if (!rootElement) {
    console.error("Root element #root not found");
    return;
  }

  // Create root only if it doesn't exist
  if (!reactRoot) {
    Logger.debug(LOGGER_SOURCE, "React root does not exist, creating...");
    reactRoot = ReactDOM.createRoot(rootElement);
    Logger.debug(LOGGER_SOURCE, "React root created.");
  } else {
    Logger.debug(LOGGER_SOURCE, "React root already exists, reusing.");
  }

  // Render the app using the existing root
  Logger.debug(LOGGER_SOURCE, "Calling reactRoot.render()...");
  reactRoot.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
  Logger.info(LOGGER_SOURCE, "React App rendered.");
}

// Function to handle initial setup and HMR re-initialization
function initializeApp() {
  Logger.debug(LOGGER_SOURCE, "initializeApp() called");
  initGame();
  renderApp();
}

// Initial setup
Logger.debug(LOGGER_SOURCE, "Starting initial setup...");
initializeApp();
Logger.debug(LOGGER_SOURCE, "Initial setup complete.");

// --- HMR Handling --- //
if (import.meta.hot) {
  // Use dispose for cleanup before the module is replaced
  import.meta.hot.dispose(() => {
    Logger.info(
      LOGGER_SOURCE,
      "HMR dispose: Stopping scenes, destroying Phaser game, and resetting managers."
    );
    if (gameInstance) {
      // Stop all active scenes first
      gameInstance.scene.getScenes(true).forEach((scene) => {
        Logger.debug(
          LOGGER_SOURCE,
          `Preparing to stop scene: ${scene.scene.key}`
        );
        try {
          // 1. Clear entities while scene context is potentially still needed for entity cleanup
          Logger.debug(
            LOGGER_SOURCE,
            `Clearing entities for scene: ${scene.scene.key}`
          );
          EntityManager.getInstance().clearEntities();

          // 2. Stop the scene - this will trigger the scene's own shutdown() method
          Logger.debug(
            LOGGER_SOURCE,
            `Stopping scene systems: ${scene.scene.key}`
          );
          if (scene && scene.sys && scene.sys.isActive()) {
            scene.sys.game.scene.stop(scene.scene.key);
          } else {
            Logger.warn(
              LOGGER_SOURCE,
              `Scene ${scene.scene.key} or its systems not available for stopping.`
            );
          }
        } catch (e) {
          Logger.error(
            LOGGER_SOURCE,
            `Error during scene stop/cleanup for ${scene.scene.key}:`,
            e
          );
        }
      });

      // 3. Now destroy the game instance itself
      Logger.debug(LOGGER_SOURCE, "Destroying Phaser game instance.");
      gameInstance.destroy(true);
      gameInstance = null;
    }
    // 4. Reset global singletons *after* game destruction
    Logger.debug(LOGGER_SOURCE, "Resetting global managers.");
    SceneManager.resetInstance();
    EntityManager.resetInstance(); // Reset the EntityManager *after* scenes are stopped/destroyed

    // React root cleanup: Crucial for HMR to prevent conflicts
    if (reactRoot) {
      Logger.debug(LOGGER_SOURCE, "Unmounting React root.");
      reactRoot.unmount();
      reactRoot = null; // Clear the variable reference as well
    }
  });

  // Accept updates for this module
  import.meta.hot.accept(() => {
    Logger.info(
      LOGGER_SOURCE,
      "HMR accept: Module reloaded. Application should re-initialize via top-level script execution."
    );
  });

  // Specific handler for App.tsx updates (optional)
  // import.meta.hot.accept(\'./App.tsx\', () => {
  //   Logger.info(LOGGER_SOURCE, \"HMR accept: App.tsx updated. Re-rendering React only.\");
  //   renderApp(); // Only re-render React part if only App.tsx changed
  // });
}
