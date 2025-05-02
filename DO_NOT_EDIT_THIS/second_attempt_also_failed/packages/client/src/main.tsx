import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import Phaser from "phaser";
// Import scenes that will be part of the initial game config
import { BootScene } from "./core/scenes/BootScene";
import { GameScene } from "./core/scenes/GameScene"; // Use index if available
import { MainMenuScene } from "./core/scenes/MainMenuScene";
import { Logger, LogLevel } from "@one-button-to-space/shared"; // Import Logger
import { EventEmitter } from "./utils/EventEmitter"; // Import the EventEmitter
import { RoomProvider } from "./colyseus"; // Import RoomProvider from the new local file

// --- Manager Imports ---
import { EngineManager } from "./managers/EngineManager";
import { SceneManager } from "./managers/SceneManager";
import { EntityManager } from "./managers/EntityManager";
import { InputManager } from "./managers/InputManager";
import { NetworkManager } from "./managers/NetworkManager";
import { PhysicsManager } from "./managers/PhysicsManager";
import { TimeManager } from "./managers/TimeManager";
import { CameraManager } from "./managers/CameraManager";

// -- Logging Setup --
// Create a set of sources to exclude
const blacklistSources = new Set<string>([
  // "🧑‍🚀✨", // Player.ts
  // "🌐", // NetworkManager.ts - Re-enable if needed
]);

// Invoke debugger after 1 second in development mode. Set to 0 to disable.
const DEBUG_DELAY = 1000;

// Set log level to TRACE, but blacklist specific sources
Logger.setFilters(LogLevel.TRACE, undefined, blacklistSources);

// Logger Source for this file
const LOGGER_SOURCE = "🚀🎬";

// --- Create Global Event Emitter --- //
export const gameEmitter = new EventEmitter();

// Store the engine manager and React root references
let engineManagerInstance: EngineManager | null = null;
let phaserGameInstance: Phaser.Game | null = null; // Renamed from gameInstance
let reactRoot: ReactDOM.Root | null = null; // Store the React root

// Removed Game configuration as it's likely handled within SceneManager/Game class

// Removed initGame() function

// --- Phaser Game Configuration --- //
const phaserConfig: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: window.innerWidth,
  height: window.innerHeight,
  parent: "phaser-container", // ID of the div where the canvas will be injected
  physics: {
    default: "matter",
    matter: {
      debug: import.meta.env.DEV,
      gravity: { x: 0, y: 0 },
      enableSleeping: true,
    },
  },
  scene: [BootScene, MainMenuScene, GameScene], // Add scenes here
  scale: {
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  backgroundColor: "#1a1a1a",
};

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

    // Ensure engineManagerInstance exists before rendering RoomProvider
    // RoomProvider might need access to managers via context or props
    if (!engineManagerInstance) {
      Logger.error(
        LOGGER_SOURCE,
        "EngineManager not initialized before rendering React app."
      );
      return;
    }

    // Render App within RoomProvider unconditionally
    // Pass engineManagerInstance to RoomProvider if needed (e.g., via props or context)
    Logger.debug(LOGGER_SOURCE, "Rendering App with RoomProvider.");
    reactRoot.render(
      <React.StrictMode>
        <RoomProvider engineManager={engineManagerInstance}>
          {" "}
          {/* Example: Pass via prop */}
          <App />
        </RoomProvider>
      </React.StrictMode>
    );
    Logger.info(LOGGER_SOURCE, "React App rendered with RoomProvider.");
  }
}

/**
 * Cleans up application resources using the EngineManager.
 * @param isHMRDispose - True if called during HMR dispose, false otherwise.
 */
function cleanupApp(isHMRDispose: boolean) {
  Logger.info(
    LOGGER_SOURCE,
    `cleanupApp: Tearing down managers via EngineManager. (HMR Dispose: ${isHMRDispose})`
  );

  // Handle NetworkManager HMR disconnect BEFORE general teardown
  if (isHMRDispose && engineManagerInstance) {
    try {
      // Attempt to leave the room gracefully if connected
      const networkManager = engineManagerInstance.getNetworkManager();
      if (networkManager.isConnected()) {
        networkManager.disconnect(); // Use disconnect which includes logging
        Logger.debug(
          LOGGER_SOURCE,
          "Called NetworkManager.disconnect() during HMR dispose."
        );
      }
    } catch (error) {
      Logger.warn(
        LOGGER_SOURCE,
        "Error during NetworkManager disconnect in HMR dispose (maybe instance/connection gone?)",
        error
      );
    }
    // We don't call teardown on NetworkManager itself here, EngineManager handles it.
  }

  // Teardown all managers via EngineManager
  if (engineManagerInstance) {
    engineManagerInstance.teardown();
    engineManagerInstance = null; // Nullify the instance after teardown
  }

  // Destroy Phaser Game Instance (AFTER managers are torn down)
  // SceneManager.teardown() should have cleaned its internal reference,
  // but the actual destruction happens here.
  if (phaserGameInstance) {
    Logger.debug(LOGGER_SOURCE, "Destroying Phaser Game instance...");
    phaserGameInstance.destroy(true); // true removes canvas
    phaserGameInstance = null;
  }

  // React root cleanup: Using custom property on DOM element
  const rootElement = document.getElementById("root");
  const customRootProperty = "__reactRootInstance";
  if (rootElement && (rootElement as any)[customRootProperty]) {
    const existingRoot = (rootElement as any)[
      customRootProperty
    ] as ReactDOM.Root;
    // Ensure unmount is only called if the root wasn't already handled elsewhere
    // try { existingRoot.unmount(); } catch (e) { console.warn("Error unmounting React root:", e); }
    existingRoot.unmount(); // Assume we always want to unmount here
    delete (rootElement as any)[customRootProperty]; // Remove property
    Logger.debug(
      LOGGER_SOURCE,
      "Unmounted React root and removed DOM property."
    );
  }
  // Always nullify the module variable as well
  reactRoot = null;

  Logger.info(LOGGER_SOURCE, "cleanupApp finished.");
}

// Function to handle initial setup and HMR re-initialization
async function initializeApp() {
  // Cleanup previous instances if any (important for HMR)
  // Pass false because this isn't an HMR dispose call itself
  cleanupApp(false);

  Logger.info(LOGGER_SOURCE, "Initializing application...");

  // 1. Create Engine Manager
  engineManagerInstance = new EngineManager();
  Logger.debug(LOGGER_SOURCE, "EngineManager created.");

  // 2. Create Phaser Game Instance
  phaserGameInstance = new Phaser.Game(phaserConfig);
  Logger.debug(LOGGER_SOURCE, "Phaser Game instance created.");
  if (import.meta.env.DEV) {
    (window as any).phaserGame = phaserGameInstance;
  }

  // 3. Create other managers, passing the engine manager
  const sceneManager = new SceneManager(engineManagerInstance);
  const entityManager = new EntityManager(engineManagerInstance);
  const inputManager = new InputManager(engineManagerInstance);
  const networkManager = new NetworkManager(engineManagerInstance);
  const physicsManager = new PhysicsManager(engineManagerInstance);
  const timeManager = new TimeManager(engineManagerInstance);
  const cameraManager = new CameraManager(engineManagerInstance);
  Logger.debug(LOGGER_SOURCE, "All individual managers created.");

  // 4. Pass Game Instance to SceneManager
  sceneManager.setGameInstance(phaserGameInstance);

  // 5. Register Managers with EngineManager
  engineManagerInstance.registerSceneManager(sceneManager);
  engineManagerInstance.registerEntityManager(entityManager);
  engineManagerInstance.registerInputManager(inputManager);
  engineManagerInstance.registerNetworkManager(networkManager);
  engineManagerInstance.registerPhysicsManager(physicsManager);
  engineManagerInstance.registerTimeManager(timeManager);
  engineManagerInstance.registerCameraManager(cameraManager);
  Logger.debug(LOGGER_SOURCE, "Managers registered with EngineManager.");

  // 6. Register EngineManager with Phaser Game Registry for Scene access
  if (phaserGameInstance) {
    phaserGameInstance.registry.set("engine", engineManagerInstance);
    Logger.debug(
      LOGGER_SOURCE,
      "EngineManager instance registered with Phaser Game registry."
    );
  }

  // 7. Run EngineManager Setup (which calls setup on all registered managers)
  try {
    await engineManagerInstance.setup();
    Logger.info(LOGGER_SOURCE, "EngineManager setup complete.");

    // 8. Render React App (only after engine setup is successful)
    renderApp();
  } catch (error) {
    Logger.error(LOGGER_SOURCE, "Error during EngineManager setup:", error);
    // Handle setup error gracefully
  }

  // Optional: Debugger launch
  if (import.meta.env.DEV && DEBUG_DELAY > 0) {
    setTimeout(() => {
      debugger;
    }, DEBUG_DELAY);
  }

  Logger.info(LOGGER_SOURCE, "Application initialization complete.");
}

// --- HMR Handling --- //
if (import.meta.hot) {
  Logger.info(LOGGER_SOURCE, "HMR enabled. Setting up dispose handler.");
  import.meta.hot.dispose(() => {
    Logger.info(LOGGER_SOURCE, "Vite HMR dispose triggered.");
    // Pass true to indicate this is an HMR dispose call
    cleanupApp(true);
  });

  // Optional: Re-initialize on accept if needed, though full reload might be simpler
  // import.meta.hot.accept(() => {
  //   console.log("Vite HMR accept triggered. Re-initializing app...");
  //   initializeApp();
  // });
}

// --- Initial App Load --- //
initializeApp().catch((error) => {
  Logger.error(
    LOGGER_SOURCE,
    "Unhandled error during initial app load:",
    error
  );
  // Display error to user? Fallback UI?
});
