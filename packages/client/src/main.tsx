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

// Create the Phaser Game instance directly
const game = new Phaser.Game(config);
Logger.info(LOGGER_SOURCE, "Phaser Game instance created.");

// Mount the React application (without passing gameManager)
ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// Optional: Make game instance globally accessible for debugging
if (import.meta.env.DEV) {
  (window as any).phaserGame = game;
  Logger.debug(
    LOGGER_SOURCE,
    "Phaser game instance attached to window for debugging."
  );
}
