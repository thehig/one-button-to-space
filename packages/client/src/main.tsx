import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import Phaser from "phaser";
import { BootScene } from "./core/scenes/BootScene.ts";
import { GameScene } from "./core/scenes/GameScene.ts";
import { MainMenuScene } from "./core/scenes/MainMenuScene.ts"; // Import the new scene
import { Logger, LogLevel } from "@one-button-to-space/shared"; // Import Logger
import { EventEmitter } from "./utils/EventEmitter"; // Import the EventEmitter
import { SceneManager } from "./managers/SceneManager"; // Corrected Import SceneManager
import { EntityManager } from "./managers/EntityManager"; // Import EntityManager
import { InputManager } from "./managers/InputManager"; // Import InputManager
import { NetworkManager } from "./managers/NetworkManager"; // Import NetworkManager
import { RoomProvider } from "./colyseus"; // Import RoomProvider from the new local file
import { GameManagerRegistry } from "./managers/GameManagerRegistry"; // Import GameManagerRegistry
import { LifecycleManager } from "./managers/lifecycle/LifecycleManager"; // ADD THIS IMPORT

// -- Logging Setup --
// Create a set of sources to exclude
const blacklistSources = new Set<string>([
  // "🧑‍🚀✨", // Player.ts
  "🌐", // NetworkManager.ts
]);

// Invoke debugger after 1 second in development mode. Set to 0 to disable.
const DEBUG_DELAY = 0;

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

  const customRootProperty = "__reactRootInstance";

  // Check if a root instance is already stored on the DOM element
  if ((rootElement as any)[customRootProperty]) {
    Logger.debug(
      LOGGER_SOURCE,
      "Found existing root instance on DOM element property. Reusing."
    );
    // Ensure our module variable is synced with the instance on the DOM
    reactRoot = (rootElement as any)[customRootProperty] as ReactDOM.Root;
  } else {
    // No root found on the element, create a new one
    Logger.debug(
      LOGGER_SOURCE,
      "No root instance found on DOM element. Creating new root..."
    );
    try {
      reactRoot = ReactDOM.createRoot(rootElement);
      // Store the new root instance on the DOM element
      (rootElement as any)[customRootProperty] = reactRoot;
      Logger.debug(
        LOGGER_SOURCE,
        "React root created and stored on DOM element property."
      );
    } catch (error) {
      Logger.error(LOGGER_SOURCE, "Error creating React root:", error);
      // If creation fails, ensure reactRoot is null
      reactRoot = null;
      throw error; // Rethrow the error after logging
    }
  }

  // Render the app using the root (if it exists)
  if (reactRoot) {
    Logger.debug(LOGGER_SOURCE, "Calling reactRoot.render()...");

    // Render App within RoomProvider unconditionally
    // RoomProvider will handle getting the room instance internally
    Logger.debug(LOGGER_SOURCE, "Rendering App with RoomProvider.");
    reactRoot.render(
      <React.StrictMode>
        <RoomProvider>
          <App />
        </RoomProvider>
      </React.StrictMode>
    );
    Logger.info(LOGGER_SOURCE, "React App rendered with RoomProvider.");
  }
}

/**
 * Cleans up application resources, optionally skipping network disconnect for HMR.
 * @param isHMRDispose - True if called during HMR dispose, false otherwise.
 */
async function cleanupApp(isHMRDispose: boolean) {
  Logger.info(
    LOGGER_SOURCE,
    `cleanupApp: Stopping scenes, destroying Phaser game, resetting managers. (HMR Dispose: ${isHMRDispose})`
  );

  // 1. Destroy Phaser game. This implicitly stops all scenes and destroys their GameObjects.
  if (gameInstance) {
    Logger.debug(LOGGER_SOURCE, "Destroying Phaser game instance...");
    gameInstance.destroy(true); // true removes canvas and stops scenes
    gameInstance = null;
    Logger.debug(LOGGER_SOURCE, "Phaser game instance destroyed.");
  }

  // 2. Handle Managers via LifecycleManager *AFTER* game/scenes are destroyed
  try {
    await LifecycleManager.getInstance().disposeAll(isHMRDispose);
  } catch (error) {
    Logger.error(
      LOGGER_SOURCE,
      "Error during LifecycleManager disposal:",
      error
    );
  }

  // 4. React root cleanup: Using custom property on DOM element
  const rootElement = document.getElementById("root");
  const customRootProperty = "__reactRootInstance";
  if (rootElement && (rootElement as any)[customRootProperty]) {
    const existingRoot = (rootElement as any)[
      customRootProperty
    ] as ReactDOM.Root;
    existingRoot.unmount();
    delete (rootElement as any)[customRootProperty];
  }
  // Always nullify the module variable as well
  reactRoot = null;
}

// Function to handle initial setup and HMR re-initialization
async function initializeApp() {
  // Initialize managers via the LifecycleManager BEFORE creating the game or rendering React
  try {
    await LifecycleManager.getInstance().initializeAll();
  } catch (error) {
    Logger.error(
      LOGGER_SOURCE,
      "Error during LifecycleManager initialization:",
      error
    );
    // Decide how to handle critical initialization errors
    return; // Stop initialization if LifecycleManager fails
  }

  initGame(); // Creates Phaser Game
  renderApp(); // Renders React App
}

// Initial setup using an IIAFE to handle top-level await
(async () => {
  await initializeApp();
})();

// --- HMR Handling --- //
if (import.meta.hot) {
  // Use dispose for cleanup before the module is replaced
  import.meta.hot.dispose(() => {
    cleanupApp(true); // Pass true for HMR dispose
  });

  // Accept updates for this module
  import.meta.hot.accept(() => {
    Logger.info(
      LOGGER_SOURCE,
      "HMR accept: Module reloaded. Explicitly calling initializeApp()."
    );
    // Explicitly call initializeApp() to ensure re-initialization
    initializeApp().catch((error) => {
      Logger.error(
        LOGGER_SOURCE,
        "Error during explicit HMR re-initialization:",
        error
      );
    });
  });
}

// --- Debug Timer ---
if (import.meta.env.DEV && DEBUG_DELAY > 0) {
  Logger.info(
    LOGGER_SOURCE,
    `Setting up debugger to trigger in ${DEBUG_DELAY / 1000} seconds.`
  );
  setTimeout(() => {
    Logger.warn(LOGGER_SOURCE, "Triggering debugger!");
    // eslint-disable-next-line no-debugger
    debugger;
  }, DEBUG_DELAY);
}
