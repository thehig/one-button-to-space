/**
 * Interface for components participating in the application lifecycle.
 * Enables centralized management of initialization, activation, deactivation, and cleanup.
 *
 * CONVENTION: Implementers should also define the following static properties:
 * - `public static readonly registrationKey: string;` (The key used in GameManagerRegistry)
 * - `public static readonly dependencies?: string[] = [];` (List of registrationKeys of dependencies)
 */
export interface LifecycleAware {
  /**
   * Initializes the component, setting up necessary resources, state, and event listeners.
   * Should be idempotent (safe to call multiple times, only initializing once).
   * **IMPORTANT:** Implementations should be idempotent (safe to call multiple times without unintended side effects,
   * typically by checking an internal 'initialized' flag). The LifecycleManager prevents calls
   * outside the IDLE state, but idempotency provides an extra layer of safety.
   * @returns {void | Promise<void>} - Can return a promise if initialization is asynchronous.
   */
  initialize(): void | Promise<void>;

  /**
   * Called when the component or its context (e.g., scene) becomes active.
   * Use this to resume activity or re-establish connections.
   * @returns {void | Promise<void>} - Can return a promise for async activation logic.
   */
  onActive?(): void | Promise<void>;

  /**
   * Called when the component or its context becomes inactive.
   * Use this to pause activity or release temporary resources.
   * @returns {void | Promise<void>} - Can return a promise for async deactivation logic.
   */
  onInactive?(): void | Promise<void>;

  /**
   * Performs comprehensive cleanup of the component's resources.
   * Should be called before the component is destroyed or during HMR cleanup.
   * Implementations should call specific cleanup methods (cleanupPhaserObjects, etc.).
   * @param {boolean} isHMR - Indicates if the disposal is triggered by Hot Module Replacement.
   * @returns {void | Promise<void>} - Can return a promise if cleanup is asynchronous.
   */
  dispose(isHMR: boolean): void | Promise<void>;

  /**
   * Optional: Cleans up specific Phaser-related objects (e.g., Sprites, Text, Graphics).
   * @returns {void | Promise<void>} - Can return a promise for async cleanup.
   */
  cleanupPhaserObjects?(): void | Promise<void>;

  /**
   * Optional: Cleans up specific MatterJS-related objects (e.g., Bodies, Constraints, Composites).
   * @returns {void | Promise<void>} - Can return a promise for async cleanup.
   */
  cleanupMatterObjects?(): void | Promise<void>;

  /**
   * Optional: Removes all event listeners (Phaser, Matter, custom EventEmitter).
   * Critical for preventing memory leaks.
   * @returns {void | Promise<void>} - Can return a promise for async cleanup.
   */
  cleanupEventListeners?(): void | Promise<void>;

  /**
   * Optional: Cancels all active timers, intervals, or scheduled callbacks.
   * @returns {void | Promise<void>} - Can return a promise for async cleanup.
   */
  cleanupTimers?(): void | Promise<void>;
}
