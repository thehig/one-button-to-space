import Phaser from "phaser";
import { Logger } from "@one-button-to-space/shared";
// SceneManager is now accessed via EngineManager from the registry
// import { SceneManager } from "../../managers/SceneManager";
import { EngineManager } from "../../managers/EngineManager"; // Import EngineManager type

// Logger Source for this file
const LOGGER_SOURCE = "👢⚙️";

/**
 * The initial scene that loads essential assets and transitions to the main game or menu.
 */
export class BootScene extends Phaser.Scene {
  // private sceneManager!: SceneManager; // No longer needed directly
  private engineManager!: EngineManager; // Store EngineManager reference

  constructor() {
    super("BootScene");
  }

  init(/*data?: object*/): void {
    Logger.info(LOGGER_SOURCE, "BootScene Init");
    // Get EngineManager from the game registry
    this.engineManager = this.registry.get("engine");
    if (!this.engineManager) {
      throw new Error(
        "EngineManager instance not found in registry. Ensure it was set in main.tsx."
      );
    }
    // this.sceneManager = SceneManager.getInstance(this.game); // Old Singleton access removed
  }

  preload(): void {
    Logger.info(LOGGER_SOURCE, "BootScene Preload");
    // Load minimal assets needed for the loading screen or next scene (e.g., loading bar, logo)
    // this.load.image('logo', 'assets/logo.png');
    // this.load.image('loadingBar', 'assets/loading_bar.png');

    // Load assets needed immediately for the GameScene (or MainMenuScene)
    // Since physics is involved, maybe load common physics shapes or default textures
    // Consider loading assets in a dedicated PreloadScene if loading takes time
    this.load.setPath("assets/"); // Set base path for assets

    // --- Load Rocket Assets ---
    this.load.image("rocket", "images/rocket.png"); // Corrected path
    this.load.image("thruster_001", "images/thruster_001.png"); // Corrected path
    this.load.image("thruster_002", "images/thruster_002.png"); // Corrected path
    // --- End Load Rocket Assets ---

    // --- Load Planet Assets ---
    // Load a default texture for planets if specific one isn't defined in state
    this.load.image("planet_default", "images/planets/default.png");
    // --- End Load Planet Assets ---

    // this.load.image("player_texture", "placeholders/player.png"); // Example placeholder
    // Add other essential assets (e.g., map tileset, common sounds)
    // this.load.image('tiles', 'tilesets/my_tileset.png');
    // this.load.tilemapTiledJSON('map', 'tilemaps/level1.json');

    // Simulate asset loading delay for demonstration
    this.load.on("progress", (value: number) => {
      // Logger.trace(LOGGER_SOURCE, `Loading progress: ${value}`);
    });

    this.load.on("complete", () => {
      Logger.debug(LOGGER_SOURCE, "Asset loading complete.");
    });

    this.load.on("loaderror", (file: Phaser.Loader.File) => {
      Logger.error(
        LOGGER_SOURCE,
        `Error loading asset: ${file.key} - ${file.url}`
      );
    });

    // Placeholder load to trigger complete event
    this.load.image(
      "placeholder",
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII="
    );
  }

  create(/*data?: object*/): void {
    Logger.info(LOGGER_SOURCE, "BootScene Create");
    // Global game settings can be configured here
    // e.g., this.physics.world.setBounds(...);

    // Transition to the next scene using the SceneManager obtained via EngineManager
    Logger.info(LOGGER_SOURCE, "Starting GameScene...");
    this.engineManager.getSceneManager().startScene("GameScene");

    // If you had a loading screen (more typical in a PreloadScene):
    // ... (loading bar logic as before) ...
    // this.load.on('complete', () => {
    //     this.engineManager.getSceneManager().startScene('MainMenuScene');
    // });
    // // Start loading all game assets here
    // this.loadAssetsForGame(); // Call a method to load everything
    // this.load.start();
  }

  // // Example method if using BootScene as a preloader
  // loadAssetsForGame(): void {
  //     this.load.setPath('assets/');
  //     // Load all game assets: images, spritesheets, audio, tilemaps, etc.
  //     this.load.image('background', 'images/background.png');
  //     this.load.spritesheet('explosion', 'sprites/explosion.png', { frameWidth: 64, frameHeight: 64 });
  //     this.load.audio('jumpSound', ['audio/jump.ogg', 'audio/jump.mp3']);
  // }
}
