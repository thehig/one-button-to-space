/* eslint-disable @typescript-eslint/no-empty-function */

/**
 * @fileoverview Base class for all manager singletons, defining a common lifecycle.
 */

/**
 * Abstract base class for manager singletons.
 * Provides standard lifecycle methods (`init`, `update`, `cleanup`, `destroy`)
 * and a basic singleton pattern structure.
 */
export abstract class BaseManager {
  /** @protected The static singleton instance reference. */
  protected static _instance: BaseManager | null = null;

  /** @protected Constructor is protected to enforce singleton pattern. */
  protected constructor() {}

  /**
   * Static getter for the singleton instance.
   * Throws an error if called on BaseManager directly or if instance not created.
   * Subclasses *must* implement their own static `getInstance()` method.
   */
  public static get instance(): BaseManager {
    if (!this._instance) {
      // This is a generic error; subclasses should override getInstance
      // to ensure correct singleton instantiation with their own type.
      throw new Error(
        "Manager instance not created. Subclass must implement getInstance."
      );
    }
    return this._instance;
  }

  /**
   * Initializes the manager. Called once after instantiation.
   * Subclasses should override this to perform setup tasks like
   * adding event listeners or initializing internal state.
   * Can be async if needed.
   */
  public init(): void | Promise<void> {}

  /**
   * Updates the manager, typically called once per game frame.
   * @param time - The current game time (usually from Phaser.Time.Clock.now).
   * @param delta - The time elapsed since the last frame in milliseconds.
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public update(time: number, delta: number): void {}

  /**
   * Performs cleanup of resources managed by this instance.
   * This is called before the instance is reset (e.g., via `resetInstance()`)
   * or fully destroyed.
   * Critical for preventing memory leaks, especially during HMR.
   * Subclasses MUST implement this to remove event listeners, clear intervals/timeouts,
   * release references, and perform any other necessary cleanup.
   *
   * @param isHMRDispose - True if called during Vite HMR `dispose` phase.
   *                       Allows managers to preserve essential state or perform
   *                       HMR-specific cleanup actions (like *not* disconnecting network).
   *                       False indicates a full teardown/reset.
   * @returns Can be async if cleanup involves asynchronous operations.
   */
  public cleanup(isHMRDispose: boolean): void | Promise<void> {}

  /**
   * Destroys the manager instance, performing a full cleanup.
   * Calls `cleanup(false)` by default.
   * Subclasses can override if additional destruction logic beyond cleanup is needed.
   * @returns Can be async if cleanup is async.
   */
  public async destroy(): Promise<void> {
    await this.cleanup(false);
  }
}
