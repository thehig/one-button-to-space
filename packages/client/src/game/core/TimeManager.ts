import { Logger } from "@one-button-to-space/shared";

const LOGGER_SOURCE = "⏱️"; // Stopwatch emoji

/**
 * Manages game time, including delta time, fixed delta time, and interpolation.
 * Handles the logic for running fixed updates based on accumulated time.
 */
export class TimeManager {
  // Configurable fixed timestep (e.g., 60 FPS for physics)
  public fixedTimeStep: number = 1 / 60;

  // Time tracking
  private lastUpdateTime: number = 0;
  private timeAccumulator: number = 0;
  private _deltaTimeS: number = 0; // Variable delta time in seconds
  private _totalElapsedTimeS: number = 0; // Total time elapsed since start
  private _currentFps: number = 0;
  private _currentUps: number = 0;

  // FPS/UPS calculation helpers
  private frameTimes: number[] = [];
  private updateTimes: number[] = [];
  private readonly maxSamples = 60; // Number of samples to average over

  constructor(fixedTimeStep: number = 1 / 60) {
    this.fixedTimeStep = fixedTimeStep;
    Logger.info(
      LOGGER_SOURCE,
      `TimeManager initialized with fixed step: ${(
        fixedTimeStep * 1000
      ).toFixed(2)}ms`
    );
  }

  /**
   * Call this at the beginning of the main game loop's update.
   * @param currentTime The current high-resolution time (e.g., from performance.now() or requestAnimationFrame)
   * @param rawDelta The raw delta time from the game loop (usually in milliseconds)
   */
  public update(currentTime: number, rawDelta: number): void {
    if (this.lastUpdateTime === 0) {
      // First update, initialize lastUpdateTime
      this.lastUpdateTime =
        currentTime - (rawDelta > 0 ? rawDelta : this.fixedTimeStep * 1000); // Estimate if rawDelta is 0
    }

    // Calculate variable delta time in seconds
    this._deltaTimeS = (currentTime - this.lastUpdateTime) / 1000;
    this.lastUpdateTime = currentTime;

    // Prevent spiral of death if deltaTime is excessively large
    if (this._deltaTimeS > this.fixedTimeStep * 8) {
      Logger.warn(
        LOGGER_SOURCE,
        `Large delta time detected (${(this._deltaTimeS * 1000).toFixed(
          1
        )}ms), capping to ${(this.fixedTimeStep * 8 * 1000).toFixed(
          1
        )}ms to prevent spiral.`
      );
      this._deltaTimeS = this.fixedTimeStep * 8;
    }

    // Add to accumulator
    this.timeAccumulator += this._deltaTimeS;
    this._totalElapsedTimeS += this._deltaTimeS;

    // Calculate FPS
    this.frameTimes.push(this._deltaTimeS);
    if (this.frameTimes.length > this.maxSamples) {
      this.frameTimes.shift();
    }
    const avgFrameTime =
      this.frameTimes.reduce((a, b) => a + b, 0) / this.frameTimes.length;
    this._currentFps = avgFrameTime > 0 ? 1 / avgFrameTime : 0;
  }

  /**
   * Checks if a fixed update step should be performed and consumes the time if so.
   * Call this in a loop within your main update.
   * @returns True if a fixed update should run, false otherwise.
   */
  public consumeFixedUpdate(): boolean {
    if (this.timeAccumulator >= this.fixedTimeStep) {
      this.timeAccumulator -= this.fixedTimeStep;

      // Calculate UPS
      this.updateTimes.push(this.fixedTimeStep); // Fixed step time
      if (this.updateTimes.length > this.maxSamples) {
        this.updateTimes.shift();
      }
      const avgUpdateTime =
        this.updateTimes.reduce((a, b) => a + b, 0) / this.updateTimes.length;
      this._currentUps = avgUpdateTime > 0 ? 1 / avgUpdateTime : 0;

      return true;
    }
    // If no fixed update consumed, UPS might slightly decrease over time if FPS < target UPS
    // We could estimate UPS based on FPS here if needed, but avgUpdateTime is more accurate when updates occur
    return false;
  }

  /** Gets the variable delta time for the current frame in seconds. */
  public get deltaTimeS(): number {
    return this._deltaTimeS;
  }

  /** Gets the total elapsed time since the TimeManager started in seconds. */
  public get totalElapsedTimeS(): number {
    return this._totalElapsedTimeS;
  }

  /** Gets the interpolation factor (alpha) based on remaining accumulated time. Useful for smooth rendering. */
  public get interpolationAlpha(): number {
    return this.timeAccumulator / this.fixedTimeStep;
  }

  /** Gets the calculated average Frames Per Second (FPS). */
  public get currentFps(): number {
    return this._currentFps;
  }

  /** Gets the calculated average (Fixed) Updates Per Second (UPS). */
  public get currentUps(): number {
    return this._currentUps;
  }
}
