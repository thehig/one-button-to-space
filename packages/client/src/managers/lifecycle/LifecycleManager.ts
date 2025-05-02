import { GameManagerRegistry } from "../GameManagerRegistry";
import type { LifecycleAware } from "./LifecycleAware";
// Assuming a shared logger instance exists or can be created
import { Logger } from "../../utils/Logger"; // Adjust path as needed
import { PhysicsManager } from "../PhysicsManager"; // Adjust path if needed

export enum ApplicationLifecycleState {
  IDLE = "idle",
  INITIALIZING = "initializing",
  ACTIVE = "active",
  INACTIVE = "inactive",
  DISPOSING = "disposing",
}

/**
 * Manages the overall application lifecycle, orchestrating events across
 * registered LifecycleAware components (typically Game Managers).
 */
export class LifecycleManager {
  private static instance: LifecycleManager | null = null;
  private registry: GameManagerRegistry;
  private currentState: ApplicationLifecycleState =
    ApplicationLifecycleState.IDLE;
  private logger = new Logger("LifecycleManager"); // Or use your existing logger

  private readonly validTransitions: Readonly<
    Record<ApplicationLifecycleState, ReadonlyArray<ApplicationLifecycleState>>
  > = {
    [ApplicationLifecycleState.IDLE]: [ApplicationLifecycleState.INITIALIZING],
    [ApplicationLifecycleState.INITIALIZING]: [
      ApplicationLifecycleState.ACTIVE,
      ApplicationLifecycleState.DISPOSING,
    ], // Allow disposing during init failure?
    [ApplicationLifecycleState.ACTIVE]: [
      ApplicationLifecycleState.INACTIVE,
      ApplicationLifecycleState.DISPOSING,
    ],
    [ApplicationLifecycleState.INACTIVE]: [
      ApplicationLifecycleState.ACTIVE,
      ApplicationLifecycleState.DISPOSING,
    ],
    [ApplicationLifecycleState.DISPOSING]: [ApplicationLifecycleState.IDLE],
  };

  private constructor() {
    this.registry = GameManagerRegistry.getInstance();
    this.logger.info("LifecycleManager initialized.");
  }

  public static getInstance(): LifecycleManager {
    if (!LifecycleManager.instance) {
      LifecycleManager.instance = new LifecycleManager();
    }
    return LifecycleManager.instance;
  }

  public getCurrentState(): ApplicationLifecycleState {
    return this.currentState;
  }

  private setState(newState: ApplicationLifecycleState): void {
    if (this.currentState === newState) {
      return; // No change
    }

    // Check if the transition is valid
    const allowedTransitions = this.validTransitions[this.currentState];
    if (!allowedTransitions || !allowedTransitions.includes(newState)) {
      this.logger.error(
        `Invalid state transition attempted: from ${this.currentState} to ${newState}. Ignoring.`
      );
      // Optionally throw an error here if invalid transitions are critical failures
      // throw new Error(`Invalid state transition attempted: from ${this.currentState} to ${newState}`);
      return;
    }

    this.logger.info(`Transitioning from ${this.currentState} to ${newState}`);
    this.currentState = newState;
    this.handleStateChange(newState);
  }

  private handleStateChange(newState: ApplicationLifecycleState): void {
    // Pause/Resume physics based on state
    const physicsManager =
      this.registry.getManager<PhysicsManager>("PhysicsManager");

    // Ensure physicsManager and the world exist before trying to access/modify them
    if (physicsManager?.scene?.matter?.world) {
      const world = physicsManager.scene.matter.world;
      const isCurrentlyPaused = !world.enabled; // Check current state if possible

      if (
        (newState === ApplicationLifecycleState.INACTIVE ||
          newState === ApplicationLifecycleState.DISPOSING) &&
        !isCurrentlyPaused
      ) {
        this.logger.debug("Pausing MatterJS world.");
        // Phaser's Matter world doesn't have a direct pause/resume.
        // We control it by enabling/disabling the world updates.
        world.enabled = false;
      } else if (
        newState === ApplicationLifecycleState.ACTIVE &&
        isCurrentlyPaused
      ) {
        // Only resume if transitioning to ACTIVE and currently paused
        this.logger.debug("Resuming MatterJS world.");
        world.enabled = true;
      }
    } else if (
      newState === ApplicationLifecycleState.INACTIVE ||
      newState === ApplicationLifecycleState.DISPOSING
    ) {
      // Log even if physics manager isn't ready, as it's expected during cleanup sometimes
      this.logger.debug(
        "Attempted to pause physics, but PhysicsManager or world not available."
      );
    }
  }

  /**
   * Sorts managers based on their declared static dependencies using topological sort.
   * @param managers - An array of managers that implement LifecycleAware and follow the static property conventions.
   * @returns A new array of managers sorted by dependency order (least dependent first).
   * @throws Error if circular dependencies are detected.
   */
  private sortManagersByDependency(
    managers: LifecycleAware[]
  ): LifecycleAware[] {
    const managerMap = new Map<string, LifecycleAware>();
    const dependencyGraph = new Map<string, string[]>();
    const inDegree = new Map<string, number>();
    const managerKeys: string[] = [];

    // Build the graph and calculate in-degrees
    for (const manager of managers) {
      // Assume static properties exist based on convention
      const ManagerClass = manager.constructor as any; // Cast to access static props
      const key = ManagerClass.registrationKey as string;
      const deps = (ManagerClass.dependencies as string[]) || [];

      if (!key) {
        this.logger.warn(
          `Manager ${ManagerClass.name} is missing static registrationKey. Skipping dependency sort for it.`
        );
        continue; // Skip managers not following the convention fully
      }

      managerKeys.push(key);
      managerMap.set(key, manager);
      dependencyGraph.set(key, deps);
      inDegree.set(key, 0); // Initialize in-degree
    }

    // Calculate actual in-degrees
    for (const key of managerKeys) {
      const deps = dependencyGraph.get(key) || [];
      for (const depKey of deps) {
        if (inDegree.has(depKey)) {
          inDegree.set(depKey, (inDegree.get(depKey) || 0) + 1);
        } else if (managerKeys.includes(depKey)) {
          // Dependency exists but wasn't in the initial loop (rare, but possible with filtering)
          inDegree.set(depKey, 1);
        } else {
          this.logger.warn(
            `Manager ${key} lists dependency '${depKey}' which is not registered or LifecycleAware. Ignoring dependency.`
          );
        }
      }
    }

    // Initialize the queue with nodes having in-degree 0
    const queue: string[] = [];
    for (const key of managerKeys) {
      if (inDegree.get(key) === 0) {
        queue.push(key);
      }
    }

    const sortedManagers: LifecycleAware[] = [];
    while (queue.length > 0) {
      // Dequeue should not be undefined here based on loop condition
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const currentKey = queue.shift()!;
      const currentManager = managerMap.get(currentKey);

      if (currentManager) {
        sortedManagers.push(currentManager);
      }

      // Process dependencies (successors in the dependency graph perspective)
      // We need to find managers that depend on the currentKey
      for (const [otherKey, otherDeps] of dependencyGraph.entries()) {
        if (otherDeps.includes(currentKey)) {
          const currentInDegree = (inDegree.get(otherKey) || 0) - 1;
          inDegree.set(otherKey, currentInDegree);
          if (currentInDegree === 0) {
            queue.push(otherKey);
          }
        }
      }
    }

    // Check for circular dependencies
    if (sortedManagers.length !== managerMap.size) {
      const missingKeys = [...managerMap.keys()].filter(
        (k) =>
          !sortedManagers.some(
            (m) => (m.constructor as any).registrationKey === k
          )
      );
      throw new Error(
        `Circular dependency detected or missing managers. Cannot fully sort. Problem keys: ${missingKeys.join(
          ", "
        )}`
      );
    }

    this.logger.debug(
      "Managers sorted by dependency:",
      sortedManagers.map((m) => (m.constructor as any).registrationKey)
    );
    return sortedManagers;
  }

  public async initializeAll(): Promise<void> {
    // setState will handle the validation check now
    this.setState(ApplicationLifecycleState.INITIALIZING);

    // Check if the state transition was successful before proceeding
    if (this.currentState !== ApplicationLifecycleState.INITIALIZING) {
      this.logger.warn(
        "Initialization aborted due to invalid state transition."
      );
      return;
    }

    this.logger.info("Initializing all registered managers...");

    let managersToInitialize: LifecycleAware[];
    try {
      const allManagers = this.registry.getAllManagers();
      const lifecycleAwareManagers = allManagers.filter(this.isLifecycleAware);
      managersToInitialize = this.sortManagersByDependency(
        lifecycleAwareManagers
      );
    } catch (error: any) {
      this.logger.error(
        "Failed to sort managers by dependency:",
        error.message
      );
      this.setState(ApplicationLifecycleState.DISPOSING); // Trigger disposal on sorting error
      return;
    }

    let initializationOk = true;
    for (const manager of managersToInitialize) {
      // Use sorted list
      // const ManagerClass = manager.constructor as any; // Get class for logging key
      try {
        this.logger.debug(
          `Initializing ${
            (manager.constructor as any).registrationKey ||
            manager.constructor.name
          }...`
        );
        await manager.initialize();
      } catch (error) {
        this.logger.error(
          `Error initializing ${
            (manager.constructor as any).registrationKey ||
            manager.constructor.name
          }:`,
          error
        );
        initializationOk = false;
        this.setState(ApplicationLifecycleState.DISPOSING);
        return;
      }
    }

    if (initializationOk) {
      this.logger.info("All managers initialized successfully.");
      this.setState(ApplicationLifecycleState.ACTIVE);
    } else {
      this.logger.error("Initialization failed for one or more managers.");
    }
  }

  public async activateAll(): Promise<void> {
    if (this.currentState !== ApplicationLifecycleState.INACTIVE) {
      this.logger.warn(
        `Activation requested while not INACTIVE (state: ${this.currentState}). Ignoring.`
      );
      return;
    }
    this.setState(ApplicationLifecycleState.ACTIVE);
    this.logger.info("Activating all registered managers...");
    const managers = this.registry.getAllManagers();
    for (const manager of managers) {
      if (
        this.isLifecycleAware(manager) &&
        typeof manager.onActive === "function"
      ) {
        try {
          this.logger.debug(`Activating ${manager.constructor.name}...`);
          await manager.onActive();
        } catch (error) {
          this.logger.error(
            `Error activating ${manager.constructor.name}:`,
            error
          );
        }
      }
    }
    this.logger.info("All managers activated.");
  }

  public async deactivateAll(): Promise<void> {
    if (this.currentState !== ApplicationLifecycleState.ACTIVE) {
      this.logger.warn(
        `Deactivation requested while not ACTIVE (state: ${this.currentState}). Ignoring.`
      );
      return;
    }
    this.setState(ApplicationLifecycleState.INACTIVE);
    this.logger.info("Deactivating all registered managers...");
    const managers = this.registry.getAllManagers().reverse(); // Deactivate in reverse order?
    for (const manager of managers) {
      if (
        this.isLifecycleAware(manager) &&
        typeof manager.onInactive === "function"
      ) {
        try {
          this.logger.debug(`Deactivating ${manager.constructor.name}...`);
          await manager.onInactive();
        } catch (error) {
          this.logger.error(
            `Error deactivating ${manager.constructor.name}:`,
            error
          );
        }
      }
    }
    this.logger.info("All managers deactivated.");
  }

  public async disposeAll(isHMR: boolean = false): Promise<void> {
    const previousState = this.currentState; // Store before attempting state change

    // Attempt to set state to DISPOSING, setState will validate
    this.setState(ApplicationLifecycleState.DISPOSING);

    // Check if the state transition was successful before proceeding
    if (this.currentState !== ApplicationLifecycleState.DISPOSING) {
      this.logger.warn(
        `Disposal aborted. Could not transition from ${previousState} to DISPOSING.`
      );
      return; // State transition failed, don't proceed
    }

    this.logger.info(`Disposing all registered managers (HMR: ${isHMR})...`);

    let managersToDispose: LifecycleAware[];
    try {
      const allManagers = this.registry.getAllManagers();
      const lifecycleAwareManagers = allManagers.filter(this.isLifecycleAware);
      // Sort by dependency, then reverse for disposal
      managersToDispose = this.sortManagersByDependency(
        lifecycleAwareManagers
      ).reverse();
    } catch (error: any) {
      this.logger.error("Failed to sort managers for disposal:", error.message);
      // Decide handling: Attempt unsorted disposal? Just stop?
      // For safety, stopping might be best if sorting fails.
      this.setState(ApplicationLifecycleState.IDLE); // Go idle if we can't reliably dispose
      return;
    }

    for (const manager of managersToDispose) {
      // Use sorted list
      const ManagerClass = manager.constructor as any; // Get class for logging key
      try {
        this.logger.debug(
          `Disposing ${
            ManagerClass.registrationKey || ManagerClass.name
          } (HMR: ${isHMR})...`
        );
        await manager.dispose(isHMR);
      } catch (error) {
        this.logger.error(
          `Error disposing ${
            ManagerClass.registrationKey || ManagerClass.name
          }:`,
          error
        );
        // Continue disposing other managers
      }
    }

    this.logger.info("All managers disposed.");
    this.setState(ApplicationLifecycleState.IDLE);

    // Optional full reset safeguard for non-HMR disposal
    if (!isHMR && this.currentState === ApplicationLifecycleState.IDLE) {
      this.logger.warn("Performing full reset after non-HMR disposal.");
      // Uncomment if a full reset is desired:
      // LifecycleManager.instance = null;
      // GameManagerRegistry.resetInstance(); // Requires GameManagerRegistry to have this static method
    }
  }

  // Type guard to check if a manager implements the LifecycleAware interface
  // Also check for the static properties convention
  private isLifecycleAware(manager: any): manager is LifecycleAware {
    const ManagerClass = manager?.constructor as any;
    return (
      manager &&
      typeof manager.dispose === "function" &&
      ManagerClass &&
      typeof ManagerClass.registrationKey === "string"
    );
  }
}
