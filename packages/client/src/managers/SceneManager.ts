/* eslint-disable @typescript-eslint/no-explicit-any */
import Phaser from "phaser";
import { BaseManager } from "./BaseManager";

export class SceneManager extends BaseManager {
  private static _instance: SceneManager | null = null;
  private game: Phaser.Game;

  private constructor(game: Phaser.Game) {
    super();
    this.game = game;
  }

  public static getInstance(game?: Phaser.Game): SceneManager {
    if (!SceneManager._instance) {
      if (!game) {
        throw new Error(
          "SceneManager requires a Phaser.Game instance on first call."
        );
      }
      SceneManager._instance = new SceneManager(game);
    }
    return SceneManager._instance;
  }

  public startScene(key: string, data?: object): void {
    if (this.game.scene.isActive(key)) {
      console.warn(`Scene ${key} is already active.`);
      return;
    }
    // Stop other scenes if needed, or manage parallel scenes
    // Example: Stop all other scenes before starting the new one
    // this.game.scene.getScenes(true).forEach(scene => {
    //     if (scene.scene.key !== key) {
    //         this.game.scene.stop(scene.scene.key);
    //     }
    // });
    this.game.scene.start(key, data);
  }

  public stopScene(key: string): void {
    if (this.game.scene.isActive(key)) {
      this.game.scene.stop(key);
    }
  }

  public getCurrentScene(): Phaser.Scene | null {
    const activeScenes = this.game.scene.getScenes(true);
    return activeScenes.length > 0 ? activeScenes[0] : null; // Simple case: assumes one active scene
  }

  // Add other scene management methods as needed (e.g., transition effects)

  public override init(): void {
    console.log("Scene Manager Initialized");
    // Initialization logic, maybe set up scene event listeners
  }

  public override destroy(): void {
    console.log("Scene Manager Destroyed");
    SceneManager._instance = null;
    // Cleanup logic
  }
}
