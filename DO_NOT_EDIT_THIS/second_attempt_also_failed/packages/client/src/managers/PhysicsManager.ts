import Phaser from "phaser";
import Matter from "matter-js"; // Explicit import for Matter types if needed elsewhere
import { BaseManager } from "./BaseManager";
import { EngineManager } from "./EngineManager"; // Added EngineManager import

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
  // Removed Singleton pattern
  // protected static _instance: PhysicsManager | null = null;
  private scene: Phaser.Scene | null = null;
  private engine: Matter.Engine | null = null;
  private world: Phaser.Physics.Matter.World | null = null;
  private engineManager: EngineManager; // Added EngineManager instance variable

  // Modified constructor to accept EngineManager
  constructor(engineManager: EngineManager) {
    super();
    this.engineManager = engineManager;
  }

  // Removed Singleton getInstance
  // public static getInstance(): PhysicsManager { ... }

  // --- Lifecycle Methods ---

  public async setup(): Promise<void> {
    // Setup waits for scene context
    console.log(
      "PhysicsManager setup initialized. Waiting for scene context..."
    );
  }

  public teardown(): void {
    console.log("Tearing down PhysicsManager...");
    // Remove listeners if added directly to the engine
    if (this.engine) {
      Matter.Events.off(this.engine, "collisionStart");
      Matter.Events.off(this.engine, "collisionActive");
      Matter.Events.off(this.engine, "collisionEnd");
    }
    this.scene = null;
    this.world = null;
    this.engine = null;
    console.log("PhysicsManager teardown complete.");
  }

  // Set the scene context, usually called by SceneManager or GameManager
  public setSceneContext(scene: Phaser.Scene): void {
    this.scene = scene;
    // Ensure Matter physics is enabled for this scene
    if (scene.matter && scene.matter.world) {
      this.world = scene.matter.world;
      this.engine = this.world.engine as Matter.Engine; // Cast is likely safe here
      console.log(
        "PhysicsManager scene context set and collision events enabled."
      );
      this.setupCollisionEvents();
    } else {
      console.error(
        "Matter physics is not enabled for the current scene. PhysicsManager will not function correctly."
      );
      this.world = null;
      this.engine = null;
    }
  }

  private setupCollisionEvents(): void {
    if (!this.scene || !this.world || !this.engine) return;
    console.log("Setting up Matter collision listeners...");

    // Use scene events which are safer with scene restarts
    this.scene.matter.world.off(
      "collisionstart",
      this.handleCollisionStart,
      this
    );
    this.scene.matter.world.off(
      "collisionactive",
      this.handleCollisionActive,
      this
    );
    this.scene.matter.world.off("collisionend", this.handleCollisionEnd, this);

    this.scene.matter.world.on(
      "collisionstart",
      this.handleCollisionStart,
      this
    );
    this.scene.matter.world.on(
      "collisionactive",
      this.handleCollisionActive,
      this
    );
    this.scene.matter.world.on("collisionend", this.handleCollisionEnd, this);

    // Remove direct engine listeners if previously used
    // Matter.Events.off(this.engine, "collisionStart");
    // Matter.Events.off(this.engine, "collisionActive");
    // Matter.Events.off(this.engine, "collisionEnd");
  }

  // --- Collision Handlers --- //

  private handleCollisionStart(
    event: Matter.IEventCollision<Matter.World>,
    bodyA: Matter.Body,
    bodyB: Matter.Body
  ): void {
    // Iterate over pairs in the event, though Phaser often provides bodyA/bodyB directly
    event.pairs.forEach((pair) => {
      // Double check pair bodies match provided bodies (usually they do)
      if (
        (pair.bodyA === bodyA && pair.bodyB === bodyB) ||
        (pair.bodyA === bodyB && pair.bodyB === bodyA)
      ) {
        this.dispatchCollision(pair, "onCollisionStart");
      }
    });
    // Handle the direct bodyA/bodyB if event.pairs is empty (shouldn't happen often)
    if (event.pairs.length === 0) {
      const pair = { bodyA, bodyB } as Matter.IPair; // Synthesize pair if needed
      this.dispatchCollision(pair, "onCollisionStart");
    }
  }

  private handleCollisionActive(
    event: Matter.IEventCollision<Matter.World>,
    bodyA: Matter.Body,
    bodyB: Matter.Body
  ): void {
    event.pairs.forEach((pair) => {
      if (
        (pair.bodyA === bodyA && pair.bodyB === bodyB) ||
        (pair.bodyA === bodyB && pair.bodyB === bodyA)
      ) {
        this.dispatchCollision(pair, "onCollisionActive");
      }
    });
    if (event.pairs.length === 0) {
      const pair = { bodyA, bodyB } as Matter.IPair; // Synthesize pair if needed
      this.dispatchCollision(pair, "onCollisionActive");
    }
  }

  private handleCollisionEnd(
    event: Matter.IEventCollision<Matter.World>,
    bodyA: Matter.Body,
    bodyB: Matter.Body
  ): void {
    event.pairs.forEach((pair) => {
      if (
        (pair.bodyA === bodyA && pair.bodyB === bodyB) ||
        (pair.bodyA === bodyB && pair.bodyB === bodyA)
      ) {
        this.dispatchCollision(pair, "onCollisionEnd");
      }
    });
    if (event.pairs.length === 0) {
      const pair = { bodyA, bodyB } as Matter.IPair; // Synthesize pair if needed
      this.dispatchCollision(pair, "onCollisionEnd");
    }
  }

  private dispatchCollision(
    pair: Matter.IPair,
    handlerMethodName: string
  ): void {
    const { bodyA, bodyB } = pair;

    // Access the GameObject instance attached to the Matter body
    // Need to handle potential undefined gameObject property
    const gameObjectA = (bodyA as any)?.gameObject as
      | Phaser.GameObjects.GameObject
      | undefined;
    const gameObjectB = (bodyB as any)?.gameObject as
      | Phaser.GameObjects.GameObject
      | undefined;

    // Call the handler method on both GameObjects if it exists
    try {
      if (
        gameObjectA &&
        typeof (gameObjectA as any)[handlerMethodName] === "function"
      ) {
        (gameObjectA as any)[handlerMethodName](gameObjectB, pair); // Pass the *other* GameObject
      }
    } catch (e) {
      console.error(
        `Error in ${handlerMethodName} for GameObject A:`,
        gameObjectA?.name,
        e
      );
    }
    try {
      if (
        gameObjectB &&
        typeof (gameObjectB as any)[handlerMethodName] === "function"
      ) {
        (gameObjectB as any)[handlerMethodName](gameObjectA, pair); // Pass the *other* GameObject
      }
    } catch (e) {
      console.error(
        `Error in ${handlerMethodName} for GameObject B:`,
        gameObjectB?.name,
        e
      );
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
    options: Partial<Matter.IBodyDefinition> & {
      width?: number;
      height?: number;
      radius?: number;
    } = {}
  ): Matter.Body {
    let body: Matter.Body | null = null;
    const defaultOptions: Matter.IBodyDefinition = {
      frictionAir: 0.01, // Example default
      friction: 0.1, // Example default
      restitution: 0.5, // Example default
      // Avoid setting position here, set it on the GameObject
    };
    // Combine options, ensuring type compatibility
    const finalOptions: Matter.IBodyDefinition = {
      ...defaultOptions,
      ...options,
    };

    switch (type) {
      case "rectangle":
        body = Matter.Bodies.rectangle(
          x,
          y,
          options.width ?? 50, // Use nullish coalescing
          options.height ?? 50,
          finalOptions
        );
        break;
      case "circle":
        body = Matter.Bodies.circle(x, y, options.radius ?? 25, finalOptions);
        break;
      // Add other shapes as needed
      default:
        console.warn(
          `Unsupported body type requested: ${type}. Creating default rectangle.`
        );
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

  // Removed BaseManager overrides
  // public override init(): void { ... }
  // public override destroy(): void { ... }
}
