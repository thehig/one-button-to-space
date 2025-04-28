import Phaser from "phaser";
import { SceneManager } from "../../managers/SceneManager";

/**
 * The initial scene that loads essential assets and transitions to the main game or menu.
 */
export class BootScene extends Phaser.Scene {
  constructor() {
    super("BootScene");
  }

  preload(): void {
    console.log("BootScene: Preload");
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
  }

  create(): void {
    console.log("BootScene: Create");
    // Global game settings can be configured here
    // e.g., this.physics.world.setBounds(...);

    // Transition to the next scene
    // Usually, you'd go to a MainMenuScene first, but we'll jump to GameScene for now
    console.log("BootScene: Starting GameScene...");
    SceneManager.getInstance(this.game).startScene("GameScene");

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
