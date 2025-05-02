import Phaser from "phaser";
import { BaseManager } from "./BaseManager";
import { GameManagerRegistry } from "./GameManagerRegistry";
import { Logger } from "@one-button-to-space/shared";

const LOGGER_SOURCE = "⏱️⏳";

export class TimeManager extends BaseManager {
  protected static override _instance: TimeManager | null = null;
  private scene: Phaser.Scene | null = null;

  protected constructor() {
    super();
  }

  public static getInstance(): TimeManager {
    if (!TimeManager._instance) {
      TimeManager._instance = new TimeManager();
      GameManagerRegistry.getInstance().registerManager(TimeManager._instance);
    }
    return TimeManager._instance;
  }

  public static resetInstance(): void {
    if (TimeManager._instance) {
      Logger.debug(LOGGER_SOURCE, "Resetting TimeManager instance.");
      TimeManager._instance.cleanup(false);
      TimeManager._instance = null;
    } else {
      Logger.trace(
        LOGGER_SOURCE,
        "TimeManager instance already null, skipping reset."
      );
    }
  }

  /**
   * Sets the current scene context for time events.
   * Should be called when a scene becomes active.
   */
  public setSceneContext(scene: Phaser.Scene): void {
    this.scene = scene;
  }

  public get gameTime(): number {
    return this.scene?.time.now ?? 0;
  }

  public get delta(): number {
    return this.scene?.game.loop.delta ?? 0;
  }

  public get fps(): number {
    return this.scene?.game.loop.actualFps ?? 0;
  }

  /**
   * Add a delayed callback.
   * @param delay Delay in milliseconds.
   * @param callback Function to execute.
   * @param context Callback context.
   * @returns The timer event.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public addTimer(
    delay: number,
    callback: () => void,
    context?: any
  ): Phaser.Time.TimerEvent | null {
    if (!this.scene) return null;
    return this.scene.time.delayedCall(delay, callback, [], context);
  }

  /**
   * Add a repeating timer event.
   * @param delay Interval in milliseconds.
   * @param callback Function to execute repeatedly.
   * @param context Callback context.
   * @returns The timer event.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public addLoop(
    delay: number,
    callback: () => void,
    context?: any
  ): Phaser.Time.TimerEvent | null {
    if (!this.scene) return null;
    return this.scene.time.addEvent({
      delay: delay,
      callback: callback,
      callbackScope: context,
      loop: true,
    });
  }

  public removeTimer(timer: Phaser.Time.TimerEvent): void {
    timer.remove();
  }

  public override init(): void {
    Logger.debug(LOGGER_SOURCE, "Time Manager Initialized");
  }

  /**
   * Cleans up TimeManager resources.
   * Currently just clears the scene reference.
   * Explicit timer cleanup might be needed if timers span scenes/HMR.
   * @param isHMRDispose - True if called during HMR dispose.
   */
  public override cleanup(isHMRDispose: boolean): void {
    Logger.info(
      LOGGER_SOURCE,
      `Time Manager cleanup called (HMR: ${isHMRDispose}).`
    );
    this.scene = null;
    Logger.debug(LOGGER_SOURCE, "Time Manager cleanup complete.");
  }

  /**
   * Destroys the TimeManager.
   */
  public override destroy(): void {
    Logger.info(LOGGER_SOURCE, "Time Manager Destroyed");
    this.cleanup(false);
  }

  // Update might be used for custom time scaling or effects in the future
  // public override update(time: number, delta: number): void {
  //     super.update(time, delta);
  // }
}
