import Phaser from "phaser";
import Matter from "matter-js"; // Explicit import for Matter types if needed elsewhere
import { BaseManager } from "./BaseManager";

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
  private static _instance: PhysicsManager | null = null;
  private scene: Phaser.Scene | null = null;
  private engine: Matter.Engine | null = null;
  private world: Phaser.Physics.Matter.World | null = null;

  private constructor() {
    super();
  }

  public static getInstance(): PhysicsManager {
    if (!PhysicsManager._instance) {
      PhysicsManager._instance = new PhysicsManager();
    }
    return PhysicsManager._instance;
  }

  public setSceneContext(scene: Phaser.Scene): void {
    this.scene = scene;
    // Ensure Matter physics is enabled for this scene
    if (scene.matter && scene.matter.world) {
      this.world = scene.matter.world;
      this.engine = this.world.engine;
      this.setupCollisionEvents();
    } else {
      console.error("Matter physics is not enabled for the current scene.");
      this.world = null;
      this.engine = null;
    }
  }

  private setupCollisionEvents(): void {
    if (!this.scene || !this.world) return;

    // Remove previous listeners if setting context multiple times
    Matter.Events.off(this.engine, "collisionStart");
    Matter.Events.off(this.engine, "collisionActive");
    Matter.Events.off(this.engine, "collisionEnd");

    this.scene.matter.world.on(
      "collisionstart",
      (event: Matter.IEventCollision<Matter.Engine>) => {
        event.pairs.forEach((pair) => {
          this.handleCollision(pair, "onCollisionStart");
        });
      }
    );

    this.scene.matter.world.on(
      "collisionactive",
      (event: Matter.IEventCollision<Matter.Engine>) => {
        event.pairs.forEach((pair) => {
          this.handleCollision(pair, "onCollisionActive");
        });
      }
    );

    this.scene.matter.world.on(
      "collisionend",
      (event: Matter.IEventCollision<Matter.Engine>) => {
        event.pairs.forEach((pair) => {
          this.handleCollision(pair, "onCollisionEnd");
        });
      }
    );
  }

  private handleCollision(pair: Matter.IPair, handlerMethodName: string): void {
    const { bodyA, bodyB } = pair;

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
      (gameObjectA as any)[handlerMethodName](gameObjectB, pair);
    }
    if (
      gameObjectB &&
      typeof (gameObjectB as any)[handlerMethodName] === "function"
    ) {
      (gameObjectB as any)[handlerMethodName](gameObjectA, pair);
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

  public override init(): void {
    console.log("Physics Manager Initialized");
  }

  public override destroy(): void {
    console.log("Physics Manager Destroyed");
    // Remove listeners if added directly to the engine
    if (this.engine) {
      Matter.Events.off(this.engine, "collisionStart");
      Matter.Events.off(this.engine, "collisionActive");
      Matter.Events.off(this.engine, "collisionEnd");
    }
    this.scene = null;
    this.world = null;
    this.engine = null;
    PhysicsManager._instance = null;
  }
}
