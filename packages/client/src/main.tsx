import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import Phaser from "phaser";
import { BootScene } from "./core/scenes/BootScene.ts";
import { GameScene } from "./core/scenes/GameScene/index.ts"; // Corrected path to directory index
import { MainMenuScene } from "./core/scenes/MainMenuScene.ts"; // Import the new scene
import { Logger, LogLevel } from "@one-button-to-space/shared"; // Import Logger
import { EventEmitter } from "./utils/EventEmitter"; // Import the EventEmitter
import { SceneManager } from "./managers/SceneManager"; // Corrected Import SceneManager
import { EntityManager } from "./managers/EntityManager"; // Import EntityManager
import { InputManager } from "./managers/InputManager"; // Import InputManager
import { NetworkManager } from "./managers/NetworkManager"; // Import NetworkManager
import { RoomProvider } from "./colyseus"; // Import RoomProvider from the new local file

// -- Logging Setup --
// Create a set of sources to exclude
const blacklistSources = new Set<string>([
  // "🧑‍🚀✨", // Player.ts
  "🌐", // NetworkManager.ts
]);

// Invoke debugger after 1 second in development mode. Set to 0 to disable.
const DEBUG_DELAY = 1000;

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
function cleanupApp(isHMRDispose: boolean) {
  Logger.info(
    LOGGER_SOURCE,
    `cleanupApp: Stopping scenes, destroying Phaser game, resetting managers. (HMR Dispose: ${isHMRDispose})`
  );

  // 1. Handle NetworkManager differently based on HMR
  if (isHMRDispose) {
    // During HMR, we want to explicitly leave the Colyseus room
    // so the server knows the old client is gone immediately.
    // We *don't* reset the NetworkManager instance itself, as a new one
    // will be created by the re-executed module code.
    try {
      NetworkManager.getInstance().leaveRoom(); // Explicitly leave
      Logger.debug(
        LOGGER_SOURCE,
        "Called NetworkManager.leaveRoom() during HMR dispose."
      );
    } catch (error) {
      Logger.warn(
        LOGGER_SOURCE,
        "Error calling leaveRoom during HMR dispose (maybe instance was already gone?)",
        error
      );
    }
    // Skip resetting the NetworkManager instance during HMR dispose
    Logger.warn(
      LOGGER_SOURCE,
      "Skipping NetworkManager reset during HMR dispose."
    );
  } else {
    // For normal page unload, reset the singleton
    NetworkManager.resetInstance();
  }

  // 2. Destroy Phaser game (stops scenes)
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
    gameInstance.destroy(true);
    gameInstance = null;
  }

  // 4. Reset other global singletons *after* game destruction & network cleanup
  Logger.debug(LOGGER_SOURCE, "Resetting other global managers.");
  SceneManager.resetInstance();
  EntityManager.resetInstance();
  InputManager.resetInstance();
  // NetworkManager is reset via its static resetInstance() method above

  // React root cleanup: Using custom property on DOM element
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
  await cleanupApp(false); // Await the cleanup process
  initGame();
  renderApp();
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
      "HMR accept: Module reloaded. Application should re-initialize via top-level script execution."
    );
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
