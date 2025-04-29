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
  const rootElement = document.getElementById("root");
  if (!rootElement) {
    console.error("Root element #root not found");
    return;
  }

  // Create root only if it doesn't exist
  if (!reactRoot) {
    reactRoot = ReactDOM.createRoot(rootElement);
  }

  // Render the app using the existing root
  reactRoot.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
  Logger.info(LOGGER_SOURCE, "React App rendered.");
}

// Initial setup
initGame();
renderApp();

// --- HMR Handling --- //
if (import.meta.hot) {
  // Use dispose for cleanup before the module is replaced
  import.meta.hot.dispose(() => {
    Logger.info(LOGGER_SOURCE, "HMR dispose: Destroying Phaser game.");
    if (gameInstance) {
      gameInstance.destroy(true);
      gameInstance = null;
    }
    // We don't unmount React root here, as the new module execution
    // will call renderApp() which reuses the existing root.
  });

  // Accept updates for this module
  import.meta.hot.accept(() => {
    Logger.info(LOGGER_SOURCE, "HMR accept: Re-initializing application.");
    // Module has been re-executed. initGame() and renderApp() should run.
    // Explicitly call them again just in case module scope execution changes behavior.
    // initGame(); // This is implicitly called by module re-run if top-level
    // renderApp(); // This is implicitly called by module re-run if top-level
    // If initGame/renderApp are not top-level calls, uncomment them here.
  });

  // If App.tsx or its dependencies update, HMR will trigger the accept above.
  // If App.tsx specifically updates, React Fast Refresh handles it mostly.
  // import.meta.hot.accept('./App.tsx', () => {
  //   Logger.info(LOGGER_SOURCE, "HMR accept: App.tsx updated. Re-rendering.");
  //   renderApp(); // Re-render the app with the updated component
  // });
}
