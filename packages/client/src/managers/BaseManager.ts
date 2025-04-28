/* eslint-disable @typescript-eslint/no-empty-function */

/**
 * Base class for all manager singletons.
 */
export abstract class BaseManager {
  private static _instance: BaseManager | null = null;

  protected constructor() {}

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
   * Initialize the manager.
   * Subclasses should override this to perform setup tasks.
   */
  public init(): void {}

  /**
   * Update the manager, typically called once per frame.
   * @param time - The current game time.
   * @param delta - The delta time since the last frame.
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public update(time: number, delta: number): void {}

  /**
   * Destroy the manager and clean up resources.
   * Subclasses should override this.
   */
  public destroy(): void {}
}
