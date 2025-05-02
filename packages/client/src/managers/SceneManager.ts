/* eslint-disable @typescript-eslint/no-explicit-any */
import Phaser from "phaser";
import { BaseManager } from "./BaseManager";
import { GameManagerRegistry } from "./GameManagerRegistry";
import { Logger } from "@one-button-to-space/shared";

// Logger Source for this file
const LOGGER_SOURCE = "🎬🎞️"; // Scene/film emojis

export class SceneManager extends BaseManager {
  protected static override _instance: SceneManager | null = null;

  protected constructor() {
    super();
  }

  public static getInstance(): SceneManager {
    if (!SceneManager._instance) {
      SceneManager._instance = new SceneManager();
      GameManagerRegistry.getInstance().registerManager(SceneManager._instance);
    }
    return SceneManager._instance;
  }

  public static resetInstance(): void {
    if (SceneManager._instance) {
      Logger.debug(LOGGER_SOURCE, "Resetting SceneManager instance.");
      SceneManager._instance.cleanup(false);
      SceneManager._instance = null;
    } else {
      Logger.trace(
        LOGGER_SOURCE,
        "SceneManager instance already null, skipping reset."
      );
    }
  }

  private getGame(): Phaser.Game | null {
    if (import.meta.env.DEV && (window as any).phaserGame) {
      return (window as any).phaserGame as Phaser.Game;
    }
    Logger.error(LOGGER_SOURCE, "Cannot reliably access Phaser.Game instance!");
    return null;
  }

  public startScene(key: string, data?: object): void {
    const game = this.getGame();
    if (!game) return;

    if (game.scene.isActive(key)) {
      Logger.warn(LOGGER_SOURCE, `Scene ${key} is already active.`);
      return;
    }
    Logger.info(LOGGER_SOURCE, `Starting scene: ${key}`, data);
    game.scene.start(key, data);
  }

  public stopScene(key: string): void {
    const game = this.getGame();
    if (!game) return;

    if (game.scene.isActive(key)) {
      Logger.info(LOGGER_SOURCE, `Stopping scene: ${key}`);
      game.scene.stop(key);
    } else {
      Logger.warn(LOGGER_SOURCE, `Attempted to stop inactive scene: ${key}`);
    }
  }

  public getCurrentScene(): Phaser.Scene | null {
    const game = this.getGame();
    if (!game) return null;

    const activeScenes = game.scene.getScenes(true);
    return activeScenes.length > 0 ? activeScenes[0] : null;
  }

  public override init(): void {
    Logger.debug(LOGGER_SOURCE, "Scene Manager Initialized");
  }

  public override cleanup(isHMRDispose: boolean): void {
    Logger.info(
      LOGGER_SOURCE,
      `Scene Manager cleanup called (HMR: ${isHMRDispose}).`
    );
    Logger.debug(LOGGER_SOURCE, "Scene Manager cleanup complete.");
  }

  public override destroy(): void {
    Logger.info(LOGGER_SOURCE, "Scene Manager Destroyed");
    this.cleanup(false);
  }
}
