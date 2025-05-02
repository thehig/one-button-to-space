import Phaser from "phaser";
import { BaseManager } from "./BaseManager";
import { EngineManager } from "./EngineManager";

export class TimeManager extends BaseManager {
  private scene: Phaser.Scene | null = null;
  private engineManager: EngineManager;

  constructor(engineManager: EngineManager) {
    super();
    this.engineManager = engineManager;
  }

  public async setup(): Promise<void> {
    console.log("TimeManager setup initialized. Waiting for scene context...");
  }

  public teardown(): void {
    console.log("Tearing down TimeManager...");
    this.scene = null;
    console.log("TimeManager teardown complete.");
  }

  /**
   * Sets the current scene context for time events.
   * Should be called when a scene becomes active, likely by SceneManager or GameManager.
   */
  public setSceneContext(scene: Phaser.Scene | null): void {
    if (this.scene !== scene) {
      console.log(
        `TimeManager context set to scene: ${scene?.scene.key ?? "null"}`
      );
      this.scene = scene;
    }
  }

  public get gameTime(): number {
    return (
      this.engineManager.getSceneManager().getGameInstance()?.loop.now ?? 0
    );
  }

  public get delta(): number {
    return (
      this.engineManager.getSceneManager().getGameInstance()?.loop.delta ?? 0
    );
  }

  public get deltaSeconds(): number {
    return (
      (this.engineManager.getSceneManager().getGameInstance()?.loop.delta ??
        0) / 1000
    );
  }

  public get fps(): number {
    return (
      this.engineManager.getSceneManager().getGameInstance()?.loop.actualFps ??
      0
    );
  }

  /**
   * Add a delayed callback.
   * Uses the *active scene's* time scale.
   * @param delay Delay in milliseconds.
   * @param callback Function to execute.
   * @param context Callback context.
   * @returns The timer event, or null if scene context is not set.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public addTimer(
    delay: number,
    callback: () => void,
    context?: any
  ): Phaser.Time.TimerEvent | null {
    if (!this.scene) {
      console.warn("Cannot add timer, TimeManager scene context not set.");
      return null;
    }
    return this.scene.time.delayedCall(delay, callback, [], context);
  }

  /**
   * Add a repeating timer event.
   * Uses the *active scene's* time scale.
   * @param delay Interval in milliseconds.
   * @param callback Function to execute repeatedly.
   * @param context Callback context.
   * @returns The timer event, or null if scene context is not set.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public addLoop(
    delay: number,
    callback: () => void,
    context?: any
  ): Phaser.Time.TimerEvent | null {
    if (!this.scene) {
      console.warn("Cannot add loop, TimeManager scene context not set.");
      return null;
    }
    return this.scene.time.addEvent({
      delay: delay,
      callback: callback,
      callbackScope: context,
      loop: true,
    });
  }

  /**
   * Removes a timer event.
   * @param timer The timer event to remove.
   */
  public removeTimer(timer: Phaser.Time.TimerEvent | null): void {
    if (timer) {
      timer.remove();
    } else {
      console.warn("Attempted to remove a null timer.");
    }
  }

  // Update might be used for custom time scaling or effects in the future
  // public override update(time: number, delta: number): void {
  //     super.update(time, delta);
  // }
}
