/**
 * @fileoverview Central registry for managing the lifecycle of singleton managers.
 */
import { Logger } from "@one-button-to-space/shared";
import { BaseManager } from "./BaseManager";

// Logger Source for this file
const LOGGER_SOURCE = "🔧⚙️";

/**
 * Manages the lifecycle and access to all other `BaseManager` singletons.
 * Ensures managers are initialized, updated, and cleaned up in a coordinated manner.
 * This is the central point for controlling manager state, especially during HMR.
 */
export class GameManagerRegistry extends BaseManager {
  // Use the singleton pattern from BaseManager
  /** @protected The static singleton instance reference. */
  protected static override _instance: GameManagerRegistry | null = null;

  /** @private Map storing registered manager instances, keyed by class name. */
  private managers: Map<string, BaseManager>;

  /** @protected Constructor is protected to enforce singleton pattern. */
  protected constructor() {
    super(); // Call BaseManager constructor
    this.managers = new Map<string, BaseManager>();
    Logger.info(LOGGER_SOURCE, "GameManagerRegistry instance created.");
  }

  /**
   * Gets the singleton instance of the GameManagerRegistry.
   * Creates it if it doesn't exist.
   * @returns The singleton GameManagerRegistry instance.
   */
  public static getInstance(): GameManagerRegistry {
    if (!GameManagerRegistry._instance) {
      GameManagerRegistry._instance = new GameManagerRegistry();
      // Note: The registry doesn't register itself.
    }
    return GameManagerRegistry._instance as GameManagerRegistry;
  }

  /**
   * Resets the singleton instance of the registry.
   * Calls `cleanupAllManagers(false)` before nullifying the instance.
   */
  public static resetInstance(): void {
    if (GameManagerRegistry._instance) {
      Logger.info(LOGGER_SOURCE, "Resetting GameManagerRegistry instance...");
      // Call cleanup before clearing the map and resetting the instance
      // Pass false for a full, non-HMR cleanup
      GameManagerRegistry._instance.cleanup(false); // Calls cleanupAllManagers internally
      GameManagerRegistry._instance = null;
      Logger.info(
        LOGGER_SOURCE,
        "GameManagerRegistry instance reset complete."
      );
    }
  }

  /**
   * Registers a manager singleton instance with the registry.
   * Automatically uses the manager's class constructor name as the registration key.
   * Called by individual managers within their `getInstance` method.
   *
   * @param manager The manager instance (`this`) to register.
   * @throws {Error} If the provided object doesn't seem to be a BaseManager instance.
   */
  public registerManager(manager: BaseManager): void {
    // Basic type check
    if (!(manager instanceof BaseManager)) {
      throw new Error(
        "Attempted to register an object that is not a BaseManager."
      );
    }
    const name = manager.constructor.name;
    if (this.managers.has(name)) {
      Logger.warn(
        LOGGER_SOURCE,
        `Manager '${name}' already registered. Overwriting.`
      );
      // Consider if overwriting should be an error in strict mode?
    }
    this.managers.set(name, manager);
    Logger.debug(LOGGER_SOURCE, `Manager '${name}' registered.`);
  }

  /**
   * Retrieves a registered manager instance by its class name.
   *
   * @template T - The type of the manager to retrieve, extending BaseManager.
   * @param name The class name (e.g., 'EntityManager') of the manager.
   * @returns The manager instance cast to type T, or undefined if not found.
   * @example
   * const entityManager = GameManagerRegistry.getInstance().getManager<EntityManager>('EntityManager');
   */
  public getManager<T extends BaseManager>(name: string): T | undefined {
    // Cast to T required as Map stores BaseManager
    const manager = this.managers.get(name) as T | undefined;
    return manager;
  }

  /**
   * Gets an array of all currently registered manager instances.
   * @returns An array containing all registered BaseManager instances.
   */
  public getAllManagers(): BaseManager[] {
    return Array.from(this.managers.values());
  }

  // --- Centralized Lifecycle Methods ---

  /**
   * Calls the `init()` method on all registered managers.
   * Intended to be called once during application startup after all managers
   * have been instantiated and registered.
   * Logs errors if manager initialization fails.
   */
  public async initializeManagers(): Promise<void> {
    // Make async to handle potential async init
    Logger.info(LOGGER_SOURCE, "Initializing all registered managers...");
    // Consider dependency order if necessary
    for (const [name, manager] of this.managers) {
      try {
        Logger.debug(LOGGER_SOURCE, `Initializing manager: ${name}`);
        await manager.init(); // Await in case init is async
      } catch (error) {
        Logger.error(
          LOGGER_SOURCE,
          `Error initializing manager ${name}:`,
          error
        );
        // Optionally re-throw or handle critical init failures
      }
    }
    Logger.info(LOGGER_SOURCE, "Finished initializing managers.");
  }

  /**
   * Calls the `update(time, delta)` method on all registered managers.
   * Intended to be called within the main game loop (e.g., Phaser scene update).
   *
   * @param time Current game time.
   * @param delta Delta time since last frame in milliseconds.
   */
  public updateManagers(time: number, delta: number): void {
    // Update in registration order (or define specific order if needed)
    this.managers.forEach((manager, name) => {
      try {
        manager.update(time, delta);
      } catch (error) {
        // Avoid spamming logs every frame. Maybe throttle errors?
        Logger.error(LOGGER_SOURCE, `Error updating manager ${name}:`, error);
      }
    });
  }

  /**
   * Calls the `cleanup(isHMRDispose)` method on all registered managers.
   * Managers are cleaned up in reverse order of registration by default.
   * Logs errors if manager cleanup fails.
   *
   * This is called by the registry's own `cleanup` method or `resetInstance`.
   * It can also be called directly by external application logic (e.g., `main.tsx`'s `cleanupApp`).
   *
   * @param isHMRDispose Indicates if cleanup is for HMR (`true`) or full teardown (`false`).
   */
  public async cleanupAllManagers(isHMRDispose: boolean): Promise<void> {
    // Make async
    Logger.info(
      LOGGER_SOURCE,
      `Cleaning up all registered managers (HMR: ${isHMRDispose})...`
    );
    // Cleanup in reverse registration order - assumes dependencies are registered before dependents
    const managersToClean = Array.from(this.managers.values()).reverse();
    for (const manager of managersToClean) {
      const name = manager.constructor.name;
      try {
        Logger.debug(LOGGER_SOURCE, `Cleaning up manager: ${name}`);
        await manager.cleanup(isHMRDispose); // Await potential async cleanup
      } catch (error) {
        Logger.error(
          LOGGER_SOURCE,
          `Error cleaning up manager ${name}:`,
          error
        );
      }
    }
    Logger.info(LOGGER_SOURCE, "Finished cleaning up managers.");
    // Clear the map *after* all managers have been cleaned up
    this.managers.clear();
    Logger.debug(LOGGER_SOURCE, "Manager map cleared.");
  }

  /**
   * Calls the `destroy()` method on all registered managers.
   * This performs a full cleanup (`cleanup(false)`) on each manager.
   * Intended for complete application shutdown.
   *
   * Called by the registry's own `destroy` method.
   */
  public async destroyManagers(): Promise<void> {
    // Make async
    Logger.info(LOGGER_SOURCE, "Destroying all registered managers...");
    const managersToDestroy = Array.from(this.managers.values()).reverse(); // Destroy in reverse order
    for (const manager of managersToDestroy) {
      const name = manager.constructor.name;
      try {
        Logger.debug(LOGGER_SOURCE, `Destroying manager: ${name}`);
        await manager.destroy(); // Await potential async destroy (which calls async cleanup)
      } catch (error) {
        Logger.error(LOGGER_SOURCE, `Error destroying manager ${name}:`, error);
      }
    }
    Logger.info(LOGGER_SOURCE, "Finished destroying managers.");
    this.managers.clear();
    Logger.debug(LOGGER_SOURCE, "Manager map cleared after destroy.");
  }

  // --- Registry Own Lifecycle Methods ---

  /** @override BaseManager.init */
  override init(): void {
    Logger.info(LOGGER_SOURCE, "GameManagerRegistry init called.");
    // The registry itself might have init logic, though usually it orchestrates others.
    // This method is called by initializeManagers if the registry itself were registered,
    // but it's typically called directly if needed: GameManagerRegistry.getInstance().init()
    // Currently, initializeManagers does NOT call init on the registry itself.
  }

  /**
   * @override BaseManager.cleanup
   * Cleans up the registry by calling `cleanupAllManagers`.
   */
  override async cleanup(isHMRDispose: boolean): Promise<void> {
    Logger.info(
      LOGGER_SOURCE,
      `GameManagerRegistry cleanup called (HMR: ${isHMRDispose}).`
    );
    await this.cleanupAllManagers(isHMRDispose);
  }

  /**
   * @override BaseManager.destroy
   * Destroys the registry by calling `destroyManagers` and clearing the static instance.
   */
  override async destroy(): Promise<void> {
    Logger.info(LOGGER_SOURCE, "GameManagerRegistry destroy called.");
    await this.destroyManagers();
    GameManagerRegistry._instance = null; // Ensure singleton instance is cleared
  }
}
