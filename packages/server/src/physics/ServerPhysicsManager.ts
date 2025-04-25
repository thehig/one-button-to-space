import Matter from "matter-js";
import { Logger } from "@one-button-to-space/shared";

const LOGGER_SOURCE = "⚛️⚙️[S]"; // Indicate server-side physics

/**
 * Manages the server-side Matter.js physics simulation.
 */
export class ServerPhysicsManager {
  public engine: Matter.Engine;
  public world: Matter.World;

  constructor() {
    Logger.debug(LOGGER_SOURCE, "Constructor: Initializing...");
    Logger.info(LOGGER_SOURCE, "Initializing server-side physics engine...");
    this.engine = Matter.Engine.create();
    this.world = this.engine.world;

    // Disable default world gravity, as we'll likely apply custom forces
    this.world.gravity.x = 0;
    this.world.gravity.y = 0;

    Logger.info(
      LOGGER_SOURCE,
      "Server physics engine initialized with gravity disabled."
    );

    // --- Setup Collision Event Listener ---
    Matter.Events.on(this.engine, "collisionStart", (event) => {
      // Forward the event to a handler (likely in GameRoom)
      // We don't process it here, just listen and forward
      // 'this.emit' or a callback could be used if needed, but
      // direct checking in GameRoom's loop might be simpler initially.
      // For now, just log that an event occurred.
      // Use info level for now to ensure visibility
      Logger.info(
        LOGGER_SOURCE,
        `CollisionStart event detected with ${event.pairs.length} pairs.`
      );
    });
    // Add listeners for 'collisionActive' and 'collisionEnd' if needed later
    // Events.on(this.engine, 'collisionActive', (event) => { ... });
    // Events.on(this.engine, 'collisionEnd', (event) => { ... });
    // -----------------------------------
    Logger.debug(LOGGER_SOURCE, "Constructor: Initialization finished.");
  }

  /**
   * Steps the physics simulation forward by a given delta time.
   * @param delta The time elapsed since the last update, in milliseconds.
   */
  update(delta: number): void {
    // Logger.debug(LOGGER_SOURCE, `Update: Stepping engine by ${delta.toFixed(2)}ms`);
    Matter.Engine.update(this.engine, delta);
    // Logger.debug(LOGGER_SOURCE, "Update: Engine step complete.");
  }

  /**
   * Adds a Matter.js body to the physics world.
   * @param body The Matter.js body to add.
   */
  addBody(body: Matter.Body): void {
    Logger.debug(
      LOGGER_SOURCE,
      `addBody: Adding body id=${body.id}, label=${body.label}`
    );
    Matter.Composite.add(this.world, body);
    // Optional: Log body addition
    // Logger.debug(LOGGER_SOURCE, `Added body ${body.id} (label: ${body.label}) to world.`);
    Logger.debug(LOGGER_SOURCE, `addBody: Finished adding body id=${body.id}`);
  }

  /**
   * Removes a Matter.js body from the physics world.
   * @param body The Matter.js body to remove.
   */
  removeBody(body: Matter.Body): void {
    Logger.debug(
      LOGGER_SOURCE,
      `removeBody: Removing body id=${body.id}, label=${body.label}`
    );
    Matter.Composite.remove(this.world, body);
    // Optional: Log body removal
    // Logger.debug(LOGGER_SOURCE, `Removed body ${body.id} (label: ${body.label}) from world.`);
    Logger.debug(
      LOGGER_SOURCE,
      `removeBody: Finished removing body id=${body.id}`
    );
  }

  /**
   * Perform necessary cleanup when the physics manager is no longer needed.
   */
  destroy(): void {
    Logger.debug(LOGGER_SOURCE, "Destroy: Starting cleanup...");
    Logger.info(LOGGER_SOURCE, "Destroying server-side physics engine...");
    // Clear the engine. Currently Engine.clear is deprecated, but might be needed
    // depending on how Matter.js handles resource cleanup internally.
    // For now, we assume garbage collection handles it once references are gone.
    // Engine.clear(this.engine); // If needed
    // World.clear(this.world, false); // If needed

    // --- Clean up Event Listeners ---
    Matter.Events.off(this.engine, "collisionStart");
    // Events.off(this.engine, 'collisionActive');
    // Events.off(this.engine, 'collisionEnd');
    // ------------------------------

    Matter.World.clear(this.engine.world, false);
    // Engine.clear(this.engine); // Clearing engine might not be necessary/desirable
    Logger.info(LOGGER_SOURCE, "Server physics engine destroyed.");
    Logger.debug(LOGGER_SOURCE, "Destroy: Cleanup finished.");
  }
}
