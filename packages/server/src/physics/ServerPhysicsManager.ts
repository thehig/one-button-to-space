import {
  Engine,
  World,
  Composite,
  Body as MatterBody,
  Events,
  IEventCollision,
  Pair,
} from "matter-js";
import { Logger } from "@one-button-to-space/shared";

const LOGGER_SOURCE = "⚛️⚙️[S]"; // Indicate server-side physics

/**
 * Manages the server-side Matter.js physics simulation.
 */
export class ServerPhysicsManager {
  public engine: Engine;
  public world: World;

  constructor() {
    Logger.info(LOGGER_SOURCE, "Initializing server-side physics engine...");
    this.engine = Engine.create();
    this.world = this.engine.world;

    // Disable default world gravity, as we'll likely apply custom forces
    this.world.gravity.x = 0;
    this.world.gravity.y = 0;

    Logger.info(
      LOGGER_SOURCE,
      "Server physics engine initialized with gravity disabled."
    );

    // --- Setup Collision Event Listener ---
    Events.on(this.engine, "collisionStart", (event) => {
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
  }

  /**
   * Steps the physics simulation forward by a given delta time.
   * @param delta The time elapsed since the last update, in milliseconds.
   */
  update(delta: number): void {
    Engine.update(this.engine, delta);
  }

  /**
   * Adds a Matter.js body to the physics world.
   * @param body The Matter.js body to add.
   */
  addBody(body: MatterBody): void {
    Composite.add(this.world, body);
    // Optional: Log body addition
    // Logger.debug(LOGGER_SOURCE, `Added body ${body.id} (label: ${body.label}) to world.`);
  }

  /**
   * Removes a Matter.js body from the physics world.
   * @param body The Matter.js body to remove.
   */
  removeBody(body: MatterBody): void {
    Composite.remove(this.world, body);
    // Optional: Log body removal
    // Logger.debug(LOGGER_SOURCE, `Removed body ${body.id} (label: ${body.label}) from world.`);
  }

  /**
   * Perform necessary cleanup when the physics manager is no longer needed.
   */
  destroy(): void {
    Logger.info(LOGGER_SOURCE, "Destroying server-side physics engine...");
    // Clear the engine. Currently Engine.clear is deprecated, but might be needed
    // depending on how Matter.js handles resource cleanup internally.
    // For now, we assume garbage collection handles it once references are gone.
    // Engine.clear(this.engine); // If needed
    // World.clear(this.world, false); // If needed

    // --- Clean up Event Listeners ---
    Events.off(this.engine, "collisionStart");
    // Events.off(this.engine, 'collisionActive');
    // Events.off(this.engine, 'collisionEnd');
    // ------------------------------

    World.clear(this.engine.world, false);
    // Engine.clear(this.engine); // Clearing engine might not be necessary/desirable
    Logger.info(LOGGER_SOURCE, "Server physics engine destroyed.");
  }
}
