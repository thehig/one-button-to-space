import Phaser from "phaser";
import { Body as MatterBody, Vector as MatterVector } from "matter-js";
// @ts-ignore - Allow importing from shared potentially outside rootDir
import { CollisionCategory } from "@one-button-to-space/shared";
// @ts-ignore - Allow importing from shared potentially outside rootDir
import { Logger } from "@one-button-to-space/shared";
// Import the singleton instance
// @ts-ignore - Allow importing from potentially outside rootDir
import { multiplayerService } from "../../services/MultiplayerService";

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

export class Rocket {
  private scene: Phaser.Scene;
  // Change gameObject to be a Container
  public gameObject: Phaser.GameObjects.Container;
  // Use imported MatterBody type
  public body: MatterBody;
  // Keep main rocket shape reference if needed internally
  private rocketShape!: Phaser.GameObjects.Rectangle;
  // Add property for the thrust visual (using Graphics)
  private thrustPolygon!: Phaser.GameObjects.Graphics | null; // Change type hint
  // Add property to store the owner's ID
  public ownerId: string;
  // Add property to track thrust state (set externally)
  public isThrusting: boolean = false;

  // --- Interpolation Targets (set by MainScene from server updates) ---
  public targetX: number;
  public targetY: number;
  public targetAngle: number; // In radians
  // Optional: Add target velocities if needed for more advanced interpolation/prediction
  // public targetVx: number = 0;
  // public targetVy: number = 0;
  // public targetAngularVelocity: number = 0;

  // Define physics properties
  private rocketWidth = 40; // Slightly narrower than visual for better collision feel
  private rocketHeight = 100;
  private rocketMass = 10;
  // Visuals align with physics body directly
  // Define offsets here for clarity
  private visualOffsetY = 0; // Main visual centered on body

  /**
   * Generates a deterministic hexadecimal color number from a string ID.
   * @param id The string identifier (e.g., ownerId).
   * @returns A hex color number (e.g., 0xff00ff).
   */
  private _generateColorFromId(id: string): number {
    let hash = 0;
    for (let i = 0; i < id.length; i++) {
      const char = id.charCodeAt(i);
      // Simple hash function (djb2 variation)
      hash = (hash << 5) - hash + char;
      hash |= 0; // Convert to 32bit integer
    }
    // Ensure positive value and map to hex color range (0x000000 to 0xffffff)
    const color = Math.abs(hash) % 0xffffff;
    Logger.debug(
      LOGGER_SOURCE,
      `Generated color for ${id}: 0x${color.toString(16).padStart(6, "0")}`
    );
    return color;
  }

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    ownerId: string,
    initialAngle: number = 0
  ) {
    this.scene = scene;
    this.ownerId = ownerId; // Store the owner ID

    // --- 1. Create Physics Body (angle 0 = right) ---
    this.body = this.scene.matter.add.rectangle(
      x,
      y,
      this.rocketWidth,
      this.rocketHeight,
      {
        mass: this.rocketMass,
        friction: 0.05,
        frictionAir: 0.01,
        restitution: 0.3,
        label: `rocket-${ownerId}`,
        collisionFilter: {
          category: CollisionCategory.ROCKET,
          // Update mask to collide with GROUND AND other ROCKETs
          mask: CollisionCategory.GROUND | CollisionCategory.ROCKET,
        },
      }
    ) as MatterBody;
    Logger.info(
      LOGGER_SOURCE,
      `Matter body created for ${ownerId} with filter:`,
      this.body.collisionFilter
    );
    // Set initial angle for the physics body
    MatterBody.setAngle(this.body, initialAngle);

    // --- 2. Create Container (matches body angle) ---
    this.gameObject = this.scene.add.container(x, y);
    Logger.info(LOGGER_SOURCE, `Container created for ${ownerId}`, { x, y });

    // --- 3. Create Visuals and Add to Container ---
    // Generate color based on owner ID
    const rocketColor = this._generateColorFromId(this.ownerId);

    // Rocket Body Visual - Use generated color
    this.rocketShape = this.scene.add.rectangle(
      0,
      0,
      this.rocketWidth,
      this.rocketHeight + 10, // Make visual slightly taller than physics body
      rocketColor // Use the generated color
    );
    // Visual created wider-than-tall to match physics body at angle 0.
    this.gameObject.add(this.rocketShape);
    Logger.info(
      LOGGER_SOURCE,
      `Rocket shape added for ${ownerId} with color 0x${rocketColor
        .toString(16)
        .padStart(6, "0")}.`
    );

    // Create Thrust Polygon Visual
    const thrustBaseY = this.rocketHeight / 2 + 5; // Y-coordinate for the top base of the flame
    const thrustHeight = 20; // Height of the flame
    const thrustWidth = this.rocketWidth * 0.6; // Width of the flame base

    // --- Create Thrust Visual using Graphics Object ---
    this.thrustPolygon = this.scene.add.graphics();
    // Set the position of the Graphics object itself
    this.thrustPolygon.x = 0; // Center horizontally
    this.thrustPolygon.y = thrustBaseY; // Position top of flame correctly

    // Define drawing commands relative to the Graphics object's origin (0,0)
    this.thrustPolygon.fillStyle(0xffa500, 1); // Orange color
    this.thrustPolygon.beginPath();
    this.thrustPolygon.moveTo(-thrustWidth / 2, 0); // Start at top-left of flame base
    this.thrustPolygon.lineTo(thrustWidth / 2, 0); // Line to top-right of flame base
    this.thrustPolygon.lineTo(0, thrustHeight); // Line to bottom tip of flame
    this.thrustPolygon.closePath();
    this.thrustPolygon.fillPath();

    this.thrustPolygon.setVisible(false); // Initially hidden
    this.gameObject.add(this.thrustPolygon);
    Logger.info(LOGGER_SOURCE, `Thrust graphics added for ${ownerId}.`);

    // Initialize target positions to starting positions
    this.targetX = x;
    this.targetY = y;
    this.targetAngle = initialAngle; // Use initial angle from server
  }

  /**
   * Updates the rocket's visual representation via interpolation.
   * @param delta The time elapsed since the last frame in milliseconds.
   */
  update(delta: number): void {
    const isLocalPlayer = this.ownerId === multiplayerService.getSessionId();

    // Use different interpolation factors based on whether it's the local player
    const lerpFactor = isLocalPlayer ? 0.7 : 0.2; // Faster follow for local
    const angleLerpFactor = isLocalPlayer ? 0.7 : 0.2; // Faster follow for local

    const adjustedLerp = lerpFactor * (delta / 16.666); // Frame-rate adjust
    const adjustedAngleLerp = angleLerpFactor * (delta / 16.666);

    // Always interpolate towards target state, but with adjusted factors
    this.gameObject.x = Phaser.Math.Linear(
      this.gameObject.x,
      this.targetX,
      adjustedLerp
    );
    this.gameObject.y = Phaser.Math.Linear(
      this.gameObject.y,
      this.targetY,
      adjustedLerp
    );

    // Interpolate angle (use RotateTo for wrapping)
    const targetVisualRotation = this.targetAngle;
    this.gameObject.rotation = Phaser.Math.Angle.RotateTo(
      this.gameObject.rotation, // Current visual rotation
      targetVisualRotation, // Target visual rotation
      adjustedAngleLerp // Smoothness factor
    );

    // Thrust visibility - Use the isThrusting property
    this.thrustPolygon?.setVisible(this.isThrusting);
  }

  // Add destroy method for cleanup
  destroy(): void {
    Logger.info(LOGGER_SOURCE, `Destroying rocket for ${this.ownerId}...`);
    if (this.body) {
      // Important: Remove the body from the Matter world
      this.scene.matter.world.remove(this.body);
      Logger.debug(LOGGER_SOURCE, ` > Matter body removed.`);
    }
    if (this.gameObject) {
      // Destroy the Phaser container and all its children (visuals)
      this.gameObject.destroy();
      Logger.debug(LOGGER_SOURCE, ` > Phaser GameObject container destroyed.`);
    }
    // Nullify references if needed, though typically handled by garbage collection
    // this.body = null;
    // this.gameObject = null;
  }
}
