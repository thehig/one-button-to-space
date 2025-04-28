import Phaser from "phaser";
import { Body as MatterBody, Vector as MatterVector } from "matter-js";
// @ts-ignore - Allow importing from shared potentially outside rootDir
import { CollisionCategory } from "@one-button-to-space/shared";
// @ts-ignore - Allow importing from shared potentially outside rootDir
import { Logger } from "@one-button-to-space/shared";
// Import the shared rocket vertices
import { rocketVertices } from "@one-button-to-space/shared";
// Import the singleton instance
// @ts-ignore - Allow importing from potentially outside rootDir
import { multiplayerService } from "../../services/MultiplayerService";
import { GameObject } from "../core/GameObject";
import {
  SpriteRenderer,
  SpriteRendererConfig,
} from "../components/SpriteRenderer";
import { PhysicsBody, PhysicsBodyConfig } from "../components/PhysicsBody";
import { MainScene } from "../scenes/MainScene"; // Needed for scene type

// Define the source constant for logging
const LOGGER_SOURCE = "🚀🌌"; // Chosen emojis for Rocket

// Define collision categories - REMOVED
/*
const CollisionCategory = {
  ROCKET: 0x0001, // Category 1 (bit 0)
  GROUND: 0x0002, // Category 2 (bit 1)
  // Add more categories later (e.g., LANDING_PAD: 0x0004)
};
*/

// Define an interface for the input state - Removed
// export interface RocketInputState {
//   thrust: boolean;
//   // Add other relevant inputs later, e.g., rotateLeft: boolean, rotateRight: boolean
// }

export class Rocket extends GameObject {
  public ownerId: string;
  private _isThrusting: boolean = false;

  // Component references (optional, but can be useful)
  private spriteRenderer?: SpriteRenderer;
  private physicsBody?: PhysicsBody;
  private thrusterSpriteRenderer?: SpriteRenderer;

  // Define physics properties directly here for clarity
  private readonly rocketWidth = 40;
  private readonly rocketHeight = 100;
  private readonly rocketMass = 10;
  private readonly visualOffsetY = -11; // Offset image relative to physics body center

  constructor(
    scene: MainScene, // Use MainScene type
    x: number,
    y: number,
    ownerId: string,
    initialAngle: number = 0
  ) {
    super(scene, `Rocket_${ownerId}`, x, y);
    this.ownerId = ownerId;
    this.rotation = initialAngle; // Set initial rotation on GameObject

    // Logger.debug(LOGGER_SOURCE, `Constructing Rocket for ${ownerId}`);

    // --- Add Components ----

    // 1. Physics Body Component
    const physicsConfig: PhysicsBodyConfig = {
      shape: "vertices",
      vertices: rocketVertices, // Use imported vertices
      mass: this.rocketMass,
      friction: 0.05,
      frictionAir: 0.01,
      restitution: 0.3,
      label: `rocket-${ownerId}`,
      collisionFilter: {
        category: CollisionCategory.ROCKET,
        mask: CollisionCategory.GROUND | CollisionCategory.ROCKET,
      },
      // chamfer: { radius: 3 } // Optional
    };
    this.physicsBody = this.addComponent(new PhysicsBody(physicsConfig));

    // 2. Main Rocket Sprite Renderer Component
    const rocketColor = this._generateColorFromId(this.ownerId);
    const spriteConfig: SpriteRendererConfig = {
      texture: "rocket",
      tint: rocketColor,
      scale: { x: this.rocketWidth / 100, y: this.rocketHeight / 100 }, // Assuming base texture is 100x100
      visualOffsetY: this.visualOffsetY,
      depth: 10, // Ensure rocket is reasonably high
    };
    this.spriteRenderer = this.addComponent(new SpriteRenderer(spriteConfig));

    // 3. Thruster Sprite Renderer Component (Added to the same GameObject)
    const thrusterConfig: SpriteRendererConfig = {
      texture: "thruster_001",
      origin: { x: 0.5, y: 0 }, // Top-center origin
      // Position thruster relative to rocket center using visual offset
      visualOffsetY: this.rocketHeight * 0.5 - 5 + this.visualOffsetY,
      scale: { x: 0.75, y: 0.75 },
      depth: 9, // Just behind the main rocket sprite
      // Tint: 0xffa500 // Optional orange tint
    };
    this.thrusterSpriteRenderer = this.addComponent(
      new SpriteRenderer(thrusterConfig)
    );
    this.thrusterSpriteRenderer.setVisible(false); // Initially hidden

    // Logger.debug(LOGGER_SOURCE, `Rocket components added for ${ownerId}`);
  }

  // --- Getters/Setters for Thrust State ---
  get isThrusting(): boolean {
    return this._isThrusting;
  }

  set isThrusting(value: boolean) {
    if (this._isThrusting === value) return; // No change
    this._isThrusting = value;
    // Logger.debug(LOGGER_SOURCE, `Thrust state set to ${value} for ${this.ownerId}`);
    this.updateThrusterVisual();
  }

  // --- Lifecycle Methods (Override GameObject if needed) ---

  // Example: Override update to handle thruster animation
  _internalUpdate(deltaTimeS: number): void {
    super._internalUpdate(deltaTimeS); // Call base to update components

    // Update thruster animation if thrusting
    if (this._isThrusting && this.thrusterSpriteRenderer) {
      // Simple flicker based on current time (toggle every ~50ms for faster flicker)
      const flickerRate = 50;
      const showFrame1 =
        Math.floor(this.scene.time.now / flickerRate) % 2 === 0;
      this.thrusterSpriteRenderer.setTexture(
        showFrame1 ? "thruster_001" : "thruster_002"
      );
    }
  }

  // --- Helper Methods ---

  private updateThrusterVisual(): void {
    if (this.thrusterSpriteRenderer) {
      this.thrusterSpriteRenderer.setVisible(this._isThrusting);
      if (!this._isThrusting) {
        // Reset to default frame when hidden
        this.thrusterSpriteRenderer.setTexture("thruster_001");
      }
    }
  }

  /**
   * Generates a deterministic hexadecimal color number from a string ID.
   */
  private _generateColorFromId(id: string): number {
    let hash = 0;
    for (let i = 0; i < id.length; i++) {
      const char = id.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash |= 0; // Convert to 32bit integer
    }
    const color = Math.abs(hash) % 0xffffff;
    // Logger.debug(LOGGER_SOURCE, `Generated color for ${id}: 0x${color.toString(16).padStart(6, '0')}`);
    return color;
  }

  // --- Public Methods (Proxy to PhysicsBody if needed) ---

  public applyForce(force: MatterVector): void {
    this.physicsBody?.applyForce(force);
  }

  // Expose the physics body if direct access is needed elsewhere
  // (Use carefully, prefer component methods)
  public getBody(): MatterBody | undefined {
    return this.physicsBody?.body;
  }

  // Override destroy to add any Rocket specific cleanup before calling super
  destroy(): void {
    // Logger.info(LOGGER_SOURCE, `Destroying Rocket GameObject for ${this.ownerId}...`);
    // Add any Rocket-specific cleanup here if needed
    super.destroy(); // IMPORTANT: Call base class destroy
  }
}
