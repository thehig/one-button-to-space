import {
  Body as MatterBody,
  Vector as MatterVector,
  Vertices,
  IBodyDefinition,
} from "matter-js";
import { ComponentBase } from "../core/IComponent";
import { GameObject } from "../core/GameObject";
import { Logger } from "@one-button-to-space/shared";
import { PhysicsManager } from "../physics/PhysicsManager"; // Adjust path

const LOGGER_SOURCE = "🔩"; // Nut and bolt emoji for physics

export interface PhysicsBodyConfig
  extends Omit<IBodyDefinition, "vertices" | "position" | "angle"> {
  shape: "rectangle" | "circle" | "vertices";
  width?: number; // For rectangle
  height?: number; // For rectangle
  radius?: number; // For circle
  vertices?: MatterVector[]; // For vertices shape
}

/**
 * Adds a Matter.js physics body to a GameObject.
 * Synchronizes the GameObject's transform with the physics body.
 */
export class PhysicsBody extends ComponentBase {
  public body: MatterBody;
  private config: PhysicsBodyConfig;
  private physicsManager: PhysicsManager;

  constructor(config: PhysicsBodyConfig) {
    super();
    this.config = config;
    // Logger.debug(LOGGER_SOURCE, "PhysicsBody constructed with config:", this.config);
  }

  awake(): void {
    super.awake();
    this.physicsManager = this.gameObject.scene
      .getGameObjectById(0)
      ?.getComponent(PhysicsManager) as PhysicsManager;
    if (!this.physicsManager) {
      Logger.error(
        LOGGER_SOURCE,
        `PhysicsManager not found on scene object for ${this.gameObject.name}! Cannot create body.`
      );
      this.active = false; // Deactivate component if manager is missing
      return;
    }

    const initialX = this.gameObject.x;
    const initialY = this.gameObject.y;
    const initialAngle = this.gameObject.rotation;

    // Logger.debug(LOGGER_SOURCE, `Creating physics body for ${this.gameObject.name} at (${initialX.toFixed(2)}, ${initialY.toFixed(2)}) angle=${initialAngle.toFixed(2)}`);

    const bodyOptions: IBodyDefinition = {
      ...this.config, // Spread collisionFilter, mass, friction etc.
      angle: initialAngle,
      // Position is set AFTER creation using MatterBody.setPosition
    };

    try {
      switch (this.config.shape) {
        case "rectangle":
          if (!this.config.width || !this.config.height)
            throw new Error("Width and height required for rectangle shape.");
          this.body = this.gameObject.scene.matter.add.rectangle(
            initialX,
            initialY,
            this.config.width,
            this.config.height,
            bodyOptions
          );
          break;
        case "circle":
          if (!this.config.radius)
            throw new Error("Radius required for circle shape.");
          this.body = this.gameObject.scene.matter.add.circle(
            initialX,
            initialY,
            this.config.radius,
            bodyOptions
          );
          break;
        case "vertices":
          if (!this.config.vertices)
            throw new Error("Vertices array required for vertices shape.");
          // Ensure vertices are valid - Matter might throw error otherwise
          const validVertices = Vertices.create(
            this.config.vertices,
            MatterBody.create(bodyOptions)
          );
          this.body = this.gameObject.scene.matter.add.fromVertices(
            initialX,
            initialY,
            validVertices, // Use validated/processed vertices
            bodyOptions
          );
          break;
        default:
          throw new Error(
            `Unsupported physics body shape: ${this.config.shape}`
          );
      }

      // Critical: Set position *after* creation for complex shapes
      // MatterBody.setPosition(this.body, { x: initialX, y: initialY });
      // Setting in factory seems okay for primitives, but vertices needs care.
      // Let's trust the factory methods for now.

      // Logger.debug(LOGGER_SOURCE, `Matter body created successfully (ID: ${this.body.id})`);

      // Add body to the physics manager (which adds to world)
      this.physicsManager.addBody(this.body);
      // Logger.debug(LOGGER_SOURCE, `Body added to PhysicsManager.`);
    } catch (error) {
      Logger.error(
        LOGGER_SOURCE,
        `Failed to create Matter body for ${this.gameObject.name}:`,
        error
      );
      this.active = false; // Disable component if body creation fails
    }
  }

  start(): void {
    super.start();
    // Potentially apply initial forces/velocities here if needed
    // Logger.debug(LOGGER_SOURCE, `PhysicsBody start for ${this.gameObject.name}`);
  }

  // No fixedUpdate needed typically, physics engine handles simulation steps
  // fixedUpdate(fixedDeltaTimeS: number): void {
  //     super.fixedUpdate(fixedDeltaTimeS);
  // }

  update(deltaTimeS: number): void {
    super.update(deltaTimeS);
    if (!this.active || !this.body) return;

    // Sync GameObject transform FROM the physics body
    this.gameObject.x = this.body.position.x;
    this.gameObject.y = this.body.position.y;
    this.gameObject.rotation = this.body.angle;

    // Optional: Sync scale if physics affects it (unlikely for Matter.js)
    // this.gameObject.scaleX = this.body.scale.x; // Matter bodies don't typically have scale like this
    // this.gameObject.scaleY = this.body.scale.y;
  }

  destroy(): void {
    // Logger.debug(LOGGER_SOURCE, `Destroying PhysicsBody for ${this.gameObject?.name}`);
    if (this.body && this.physicsManager) {
      this.physicsManager.removeBody(this.body);
      // Logger.debug(LOGGER_SOURCE, `Body removed from PhysicsManager.`);
      // @ts-ignore
      this.body = null; // Help GC
    }
    super.destroy(); // Call base destroy
  }

  // --- Public Methods to Interact with the Body ---
  public applyForce(force: MatterVector): void {
    if (this.body && this.active) {
      MatterBody.applyForce(this.body, this.body.position, force);
    }
  }

  public setVelocity(velocity: MatterVector): void {
    if (this.body && this.active) {
      MatterBody.setVelocity(this.body, velocity);
    }
  }

  public setAngle(angle: number): void {
    if (this.body && this.active) {
      MatterBody.setAngle(this.body, angle);
    }
  }

  public setAngularVelocity(velocity: number): void {
    if (this.body && this.active) {
      MatterBody.setAngularVelocity(this.body, velocity);
    }
  }
}
