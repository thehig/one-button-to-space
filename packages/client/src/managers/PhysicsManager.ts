import Phaser from "phaser";
import Matter from "matter-js"; // Explicit import for Matter types if needed elsewhere
import { BaseManager } from "./BaseManager";
import { GameManagerRegistry } from "./GameManagerRegistry"; // Import registry
import { Logger } from "@one-button-to-space/shared"; // Import Logger

// Logger Source for this file
const LOGGER_SOURCE = "⚖️🔩"; // Physics/mechanics emojis

// Define collision categories (example)
// Ensure these align with server-side definitions if used for filtering
export const CollisionCategories = {
  DEFAULT: 0x0001, // Default Phaser category
  PLAYER: 0x0002,
  ENEMY: 0x0004,
  WALL: 0x0008,
  PROJECTILE_PLAYER: 0x0010,
  PROJECTILE_ENEMY: 0x0020,
  SENSOR: 0x0040,
  // Add more categories as needed
};

export class PhysicsManager extends BaseManager {
  // Use protected static for instance according to BaseManager pattern
  protected static override _instance: PhysicsManager | null = null;
  private scene: Phaser.Scene | null = null;
  private engine: Matter.Engine | null = null;
  private world: Phaser.Physics.Matter.World | null = null;

  protected constructor() {
    super();
    // Don't register here
  }

  public static getInstance(): PhysicsManager {
    if (!PhysicsManager._instance) {
      PhysicsManager._instance = new PhysicsManager();
      // Register the newly created instance
      GameManagerRegistry.getInstance().registerManager(
        PhysicsManager._instance
      );
    }
    return PhysicsManager._instance;
  }

  // Static method to reset the singleton instance
  public static resetInstance(): void {
    if (PhysicsManager._instance) {
      Logger.debug(LOGGER_SOURCE, "Resetting PhysicsManager instance.");
      // Call instance cleanup before nullifying
      PhysicsManager._instance.cleanup(false); // Pass false for full reset
      PhysicsManager._instance = null;
    } else {
      Logger.trace(
        LOGGER_SOURCE,
        "PhysicsManager instance already null, skipping reset."
      );
    }
  }

  public setSceneContext(scene: Phaser.Scene): void {
    this.scene = scene;
    // Ensure Matter physics is enabled for this scene
    if (scene.matter && scene.matter.world) {
      this.world = scene.matter.world;
      this.engine = this.world.engine as Matter.Engine;
      this.setupCollisionEvents();
    } else {
      console.error("Matter physics is not enabled for the current scene.");
      this.world = null;
      this.engine = null;
    }
  }

  private setupCollisionEvents(): void {
    if (!this.scene || !this.world || !this.engine) {
      Logger.warn(
        LOGGER_SOURCE,
        "Cannot setup collision events: Scene, World, or Engine not available."
      );
      return;
    }

    // Remove previous listeners first to prevent duplicates
    // Note: Phaser's world.on also uses an EventEmitter, but removing from Matter.Events is safer if direct engine listeners were ever added.
    Logger.debug(
      LOGGER_SOURCE,
      "Clearing existing Matter collision listeners (if any)..."
    );
    Matter.Events.off(this.engine, "collisionStart");
    Matter.Events.off(this.engine, "collisionActive");
    Matter.Events.off(this.engine, "collisionEnd");
    // Also clear Phaser's listeners on the world
    this.world.off("collisionstart");
    this.world.off("collisionactive");
    this.world.off("collisionend");

    Logger.debug(LOGGER_SOURCE, "Setting up new Matter collision listeners...");
    // Use Phaser's world event emitter which wraps Matter's
    this.world.on(
      "collisionstart",
      (
        event: Matter.IEventCollision<Matter.Engine>,
        bodyA: Matter.Body,
        bodyB: Matter.Body
      ) => {
        // Phaser passes bodyA and bodyB directly
        this.handleCollisionPair(bodyA, bodyB, "onCollisionStart");
      }
    );

    this.world.on(
      "collisionactive",
      (
        event: Matter.IEventCollision<Matter.Engine>,
        bodyA: Matter.Body,
        bodyB: Matter.Body
      ) => {
        this.handleCollisionPair(bodyA, bodyB, "onCollisionActive");
      }
    );

    this.world.on(
      "collisionend",
      (
        event: Matter.IEventCollision<Matter.Engine>,
        bodyA: Matter.Body,
        bodyB: Matter.Body
      ) => {
        this.handleCollisionPair(bodyA, bodyB, "onCollisionEnd");
      }
    );
    Logger.debug(LOGGER_SOURCE, "Collision listeners setup complete.");
  }

  // Updated handler to take bodies directly as passed by Phaser world events
  private handleCollisionPair(
    bodyA: Matter.Body,
    bodyB: Matter.Body,
    handlerMethodName: string
  ): void {
    // Access the GameObject instance attached to the Matter body
    const gameObjectA = (bodyA as any).gameObject as
      | Phaser.GameObjects.GameObject
      | undefined;
    const gameObjectB = (bodyB as any).gameObject as
      | Phaser.GameObjects.GameObject
      | undefined;

    // Call the handler method on both GameObjects if it exists
    if (
      gameObjectA &&
      typeof (gameObjectA as any)[handlerMethodName] === "function"
    ) {
      (gameObjectA as any)[handlerMethodName](gameObjectB, bodyA, bodyB); // Pass bodies too
    }
    if (
      gameObjectB &&
      typeof (gameObjectB as any)[handlerMethodName] === "function"
    ) {
      (gameObjectB as any)[handlerMethodName](gameObjectA, bodyB, bodyA); // Pass bodies too
    }
  }

  // --- Utility Methods ---

  /**
   * Creates a Matter body with common defaults.
   * Remember physics is server-authoritative, so this is mainly for client-side prediction
   * or visual representation.
   *
   * @param x X position
   * @param y Y position
   * @param type 'rectangle', 'circle', etc.
   * @param options Matter body options
   * @returns The created Matter body
   */
  public createBody(
    x: number,
    y: number,
    type: string,
    options: Matter.IBodyDefinition = {}
  ): Matter.Body {
    let body: Matter.Body | null = null;
    const defaultOptions: Matter.IBodyDefinition = {
      frictionAir: 0.01, // Example default
      friction: 0.1, // Example default
      restitution: 0.5, // Example default
      // Avoid setting position here, set it on the GameObject
    };
    const finalOptions = { ...defaultOptions, ...options };

    switch (type) {
      case "rectangle":
        body = Matter.Bodies.rectangle(
          x,
          y,
          options.width || 50,
          options.height || 50,
          finalOptions
        );
        break;
      case "circle":
        body = Matter.Bodies.circle(x, y, options.radius || 25, finalOptions);
        break;
      // Add other shapes as needed
      default:
        console.warn(`Unsupported body type: ${type}`);
        // Create a default body or throw error
        body = Matter.Bodies.rectangle(x, y, 50, 50, finalOptions);
    }
    return body;
  }

  public setCollisionProperties(
    body: Matter.Body,
    category: number,
    collidesWith?: number
  ): void {
    body.collisionFilter = {
      category: category,
      mask: collidesWith ?? 0xffffffff, // Collide with everything by default
      group: 0, // Default group
    };
  }

  // Since physics is server-authoritative, direct manipulation methods (applyForce, setVelocity)
  // should primarily be driven by server updates, not client input directly.

  // --- Lifecycle Methods ---

  public override init(): void {
    Logger.debug(LOGGER_SOURCE, "Physics Manager Initialized");
    // Any specific initialization needed
  }

  /**
   * Cleans up PhysicsManager resources.
   * @param isHMRDispose - True if called during HMR dispose.
   */
  public override cleanup(isHMRDispose: boolean): void {
    Logger.info(
      LOGGER_SOURCE,
      `Physics Manager cleanup called (HMR: ${isHMRDispose}).`
    );
    // Logic moved from original destroy method
    if (this.engine) {
      Logger.debug(
        LOGGER_SOURCE,
        "Removing Matter.Events listeners from engine."
      );
      Matter.Events.off(this.engine, "collisionStart");
      Matter.Events.off(this.engine, "collisionActive");
      Matter.Events.off(this.engine, "collisionEnd");
    }
    if (this.world) {
      Logger.debug(LOGGER_SOURCE, "Removing Phaser world collision listeners.");
      this.world.off("collisionstart");
      this.world.off("collisionactive");
      this.world.off("collisionend");
    }
    this.scene = null;
    this.world = null;
    this.engine = null;
    Logger.debug(LOGGER_SOURCE, "Physics Manager cleanup complete.");
  }

  /**
   * Destroys the PhysicsManager.
   */
  public override destroy(): void {
    Logger.info(LOGGER_SOURCE, "Physics Manager Destroyed");
    this.cleanup(false); // Call full cleanup on destroy
  }
}
