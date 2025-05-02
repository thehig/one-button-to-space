/* eslint-disable @typescript-eslint/no-explicit-any */
import Phaser from "phaser";
import { BaseManager } from "./BaseManager";
import { EngineManager } from "./EngineManager";

export class SceneManager extends BaseManager {
  private game: Phaser.Game | null = null;
  private engineManager: EngineManager;

  constructor(engineManager: EngineManager) {
    super();
    this.engineManager = engineManager;
  }

  public async setup(): Promise<void> {
    console.log("SceneManager setup initialized. Waiting for game instance...");
  }

  public teardown(): void {
    console.log("Tearing down SceneManager...");
    this.game = null;
    console.log("SceneManager teardown complete.");
  }

  public setGameInstance(gameInstance: Phaser.Game): void {
    if (this.game) {
      console.warn("SceneManager: Game instance is already set. Overwriting.");
    }
    this.game = gameInstance;
    console.log("SceneManager: Phaser Game instance received.");
  }

  public startScene(key: string, data?: object): void {
    if (!this.game) {
      console.error(
        "Cannot start scene, Phaser Game not available in SceneManager."
      );
      return;
    }
    if (this.game.scene.isActive(key)) {
      console.warn(`Scene ${key} is already active. Restarting.`);
      this.game.scene.stop(key);
    }

    console.log(`Starting scene: ${key}`, data ?? "");
    this.game.scene.start(key, data);
  }

  public stopScene(key: string): void {
    if (!this.game) {
      console.error(
        "Cannot stop scene, Phaser Game not available in SceneManager."
      );
      return;
    }
    if (this.game.scene.isActive(key)) {
      console.log(`Stopping scene: ${key}`);
      this.game.scene.stop(key);
    }
  }

  public getCurrentScene(): Phaser.Scene | null {
    if (!this.game) return null;
    const activeScenes = this.game.scene.getScenes(true);
    return activeScenes.length > 0 ? activeScenes[0] : null;
  }

  public getGameInstance(): Phaser.Game | null {
    return this.game;
  }
}
