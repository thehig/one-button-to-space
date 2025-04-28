import Phaser from "phaser";
import { BaseManager } from "./BaseManager";

export class TimeManager extends BaseManager {
  protected static _instance: TimeManager | null = null;
  private scene: Phaser.Scene | null = null;

  private constructor() {
    super();
  }

  public static getInstance(): TimeManager {
    if (!TimeManager._instance) {
      TimeManager._instance = new TimeManager();
    }
    return TimeManager._instance;
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
    console.log("Time Manager Initialized");
  }

  public override destroy(): void {
    console.log("Time Manager Destroyed");
    this.scene = null; // Clear scene reference
    TimeManager._instance = null;
  }

  // Update might be used for custom time scaling or effects in the future
  // public override update(time: number, delta: number): void {
  //     super.update(time, delta);
  // }
}
