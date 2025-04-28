import Phaser from "phaser";
import { BootScene } from "./scenes/BootScene";
import { GameScene } from "./scenes/GameScene"; // Placeholder for main game scene
// Import other scenes: MainMenuScene, etc.

export class Game extends Phaser.Game {
  public static instance: Game;

  constructor() {
    const config: Phaser.Types.Core.GameConfig = {
      type: Phaser.AUTO, // Auto-detect WebGL or Canvas
      parent: "game-container", // ID of the div to contain the game
      width: window.innerWidth,
      height: window.innerHeight,
      scale: {
        mode: Phaser.Scale.RESIZE, // Resize game to fit window
        autoCenter: Phaser.Scale.CENTER_BOTH,
      },
      physics: {
        default: "matter",
        matter: {
          debug: import.meta.env.DEV, // Show physics debug info in development
          gravity: { y: 0 }, // Top-down game, adjust as needed
          // enableSleeping: true, // Optimization for static bodies
        },
      },
      scene: [
        BootScene,
        GameScene,
        // Add other scenes here (e.g., MainMenuScene)
      ],
      backgroundColor: "#000000",
    };

    super(config);
    Game.instance = this;

    window.addEventListener("resize", this.handleResize.bind(this));
  }

  private handleResize(): void {
    this.scale.resize(window.innerWidth, window.innerHeight);
    // Optionally, notify scenes or managers about the resize
    this.scene.getScenes(true).forEach((scene) => {
      if (typeof (scene as any).onResize === "function") {
        (scene as any).onResize(window.innerWidth, window.innerHeight);
      }
    });
  }

  // Add methods for global game management if needed
  // e.g., pauseGame(), resumeGame(), etc.
}
