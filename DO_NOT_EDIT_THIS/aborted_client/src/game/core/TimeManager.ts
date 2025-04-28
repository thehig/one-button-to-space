import { Logger } from "@one-button-to-space/shared";

const LOGGER_SOURCE = "⏱️"; // Stopwatch emoji

/**
 * Manages game time, including delta time, fixed delta time, and interpolation.
 * Handles the logic for running fixed updates based on accumulated time.
 */
export class TimeManager {
  // Configurable fixed timestep (e.g., 60 FPS for physics)
  public readonly fixedTimeStep: number;
  private _fixedDeltaTimeS: number; // Actual fixed delta time in seconds

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

  constructor(fixedTimeStepSeconds: number = 1 / 60) {
    this.fixedTimeStep = fixedTimeStepSeconds;
    this._fixedDeltaTimeS = fixedTimeStepSeconds; // Initialize fixedDeltaTimeS
    Logger.info(
      LOGGER_SOURCE,
      `TimeManager initialized with fixed step: ${(
        fixedTimeStepSeconds * 1000
      ).toFixed(2)}ms`
    );
  }

  /**
   * Call this at the beginning of the main game loop's variable update.
   * Calculates variable deltaTimeS and adds to the accumulator.
   * @param currentTime The current high-resolution time (e.g., from performance.now())
   */
  public update(currentTime: number): void {
    // Remove rawDelta parameter
    const now = currentTime;
    if (this.lastUpdateTime === 0) {
      this.lastUpdateTime = now - this.fixedTimeStep * 1000; // Estimate start
    }

    const elapsedMs = now - this.lastUpdateTime;
    this.lastUpdateTime = now;

    this._deltaTimeS = elapsedMs / 1000;

    // Prevent spiral of death
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
   * Processes the fixed update loop based on accumulated time.
   * Should be called repeatedly until it returns false within the main game loop,
   * typically after the variable update.
   *
   * @param fixedUpdateCallback The function to call for each fixed step.
   *                            It receives fixedDeltaTimeS as an argument.
   */
  public processFixedUpdates(
    fixedUpdateCallback: (fixedDeltaTimeS: number) => void
  ): void {
    let updatesProcessed = 0;
    while (this.timeAccumulator >= this.fixedTimeStep) {
      this.timeAccumulator -= this.fixedTimeStep;
      this._fixedDeltaTimeS = this.fixedTimeStep; // Use the configured step

      // --- Call the fixed update logic ---
      fixedUpdateCallback(this._fixedDeltaTimeS);
      // -------------------------------------

      updatesProcessed++;

      // Safety break to prevent infinite loops if something goes wrong
      if (updatesProcessed > 10) {
        Logger.error(
          LOGGER_SOURCE,
          "Exceeded max fixed updates per frame (10). Breaking loop."
        );
        this.timeAccumulator = 0; // Reset accumulator to escape
        break;
      }
    }

    // Calculate UPS based on updates processed this frame (or average if needed)
    // Simple UPS based on processing rate this frame:
    const potentialUPS =
      this._deltaTimeS > 0 ? updatesProcessed / this._deltaTimeS : 0;
    // Averaging UPS (more stable reading):
    if (updatesProcessed > 0) {
      // Add samples based on *how many* updates were done
      for (let i = 0; i < updatesProcessed; i++) {
        this.updateTimes.push(this.fixedTimeStep);
      }
      while (this.updateTimes.length > this.maxSamples) {
        this.updateTimes.shift();
      }
    }
    const avgUpdateTime =
      this.updateTimes.length > 0
        ? this.updateTimes.reduce((a, b) => a + b, 0) / this.updateTimes.length
        : this.fixedTimeStep; // Avoid division by zero, estimate based on target
    this._currentUps = avgUpdateTime > 0 ? 1 / avgUpdateTime : 0;
  }

  /** Gets the variable delta time for the current frame in seconds. */
  public get deltaTimeS(): number {
    return this._deltaTimeS;
  }

  /** Gets the fixed delta time used for the last fixed update step(s) in seconds. */
  public get fixedDeltaTimeS(): number {
    return this._fixedDeltaTimeS;
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
