import Phaser from "phaser";
import { Logger } from "@one-button-to-space/shared";
import { SceneManager } from "../../managers/SceneManager";

// Logger Source for this file
const LOGGER_SOURCE = "👢⚙️";

/**
 * The initial scene that loads essential assets and transitions to the main game or menu.
 */
export class BootScene extends Phaser.Scene {
  private sceneManager!: SceneManager;

  constructor() {
    super("BootScene");
  }

  init(/*data?: object*/): void {
    Logger.info(LOGGER_SOURCE, "BootScene Init");
    this.sceneManager = SceneManager.getInstance(this.game);
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

    // Transition to the next scene
    // Usually, you'd go to a MainMenuScene first, but we'll jump to GameScene for now
    Logger.info(LOGGER_SOURCE, "Starting GameScene...");
    this.sceneManager.startScene("GameScene");

    // If you had a loading screen (more typical in a PreloadScene):
    // ... (loading bar logic as before) ...
    // this.load.on('complete', () => {
    //     SceneManager.getInstance(this.game).startScene('MainMenuScene');
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
