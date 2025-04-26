import Phaser from "phaser";
import { Body as MatterBody, Vector as MatterVector } from "matter-js";
import { CollisionCategory } from "@one-button-to-space/shared";
import { Logger } from "@one-button-to-space/shared";
// Import the singleton instance
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
  public gameObject: Phaser.GameObjects.Container;
  public body: MatterBody;
  private rocketImage!: Phaser.GameObjects.Image;
  private thrustPolygon!: Phaser.GameObjects.Graphics | null;
  public ownerId: string;
  public isThrusting: boolean = false;

  // Define physics properties
  private rocketWidth = 40; // Slightly narrower than visual for better collision feel
  private rocketHeight = 100;
  private rocketMass = 10;
  // Visual Offset: Adjust Y position of the image relative to the physics body center
  private visualOffsetY = -11; // Try shifting image slightly more backward

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
    this.ownerId = ownerId;

    // --- Define Vertices for Collision Shape based on rocket.png ---
    // Relative to center (0,0), physics body height=100
    const rocketVertices = [
      { x: 0, y: -50 }, // Nose tip
      { x: 10, y: -40 }, // Right shoulder (narrower)
      { x: 10, y: 35 }, // Right side base (narrower)
      { x: 20, y: 50 }, // Right fin tip (slightly narrower)
      { x: -20, y: 50 }, // Left fin tip (slightly narrower)
      { x: -10, y: 35 }, // Left side base (narrower)
      { x: -10, y: -40 }, // Left shoulder (narrower)
    ];

    // --- 1. Create Physics Body using Vertices ---
    this.body = this.scene.matter.add.fromVertices(
      x,
      y,
      rocketVertices, // Use the defined vertices
      {
        mass: this.rocketMass,
        friction: 0.05,
        frictionAir: 0.01,
        restitution: 0.3,
        label: `rocket-${ownerId}`,
        collisionFilter: {
          category: CollisionCategory.ROCKET,
          mask: CollisionCategory.GROUND | CollisionCategory.ROCKET,
        },
        // Consider chamfer if collisions feel too sharp later
        // chamfer: { radius: 3 }
      }
    ) as MatterBody;
    Logger.info(
      LOGGER_SOURCE,
      `Matter body created from vertices for ${ownerId} with filter:`,
      this.body.collisionFilter
    );
    MatterBody.setAngle(this.body, initialAngle);

    // --- 2. Create Container ---
    this.gameObject = this.scene.add.container(x, y);
    Logger.info(LOGGER_SOURCE, `Container created for ${ownerId}`, { x, y });

    // --- 3. Create Visuals and Add to Container ---
    // REMOVE Color generation - REINSTATE this line
    const rocketColor = this._generateColorFromId(this.ownerId);

    // REMOVE Rectangle creation
    /*
    this.rocketShape = this.scene.add.rectangle(
      0,
      0,
      this.rocketWidth,
      this.rocketHeight + 10,
      rocketColor
    );
    this.gameObject.add(this.rocketShape);
    Logger.info(
      LOGGER_SOURCE,
      `Rocket shape added for ${ownerId} with color 0x${rocketColor
        .toString(16)
        .padStart(6, "0")}.`
    );
    */

    // ADD Rocket Image Visual using preloaded asset
    this.rocketImage = this.scene.add.image(0, this.visualOffsetY, "rocket"); // Apply Y offset here
    this.rocketImage.setOrigin(0.5, 0.5); // Center the origin
    this.rocketImage.setDisplaySize(this.rocketWidth, this.rocketHeight); // Match physics size
    // Apply the generated color as a tint
    this.rocketImage.setTint(rocketColor);
    this.gameObject.add(this.rocketImage);
    Logger.info(
      LOGGER_SOURCE,
      `Rocket image added for ${ownerId} with tint 0x${rocketColor
        .toString(16)
        .padStart(6, "0")}.`
    );

    // Create Thrust Polygon Visual - Adjust Y relative to image origin/size
    const thrustBaseY = this.rocketHeight * 0.5 + 5; // Relative to container center
    const thrustHeight = 20;
    const thrustWidth = this.rocketWidth * 0.6;

    this.thrustPolygon = this.scene.add.graphics();
    this.thrustPolygon.x = 0;
    this.thrustPolygon.y = thrustBaseY;
    this.thrustPolygon.fillStyle(0xffa500, 1); // Orange color
    this.thrustPolygon.beginPath();
    this.thrustPolygon.moveTo(-thrustWidth / 2, 0);
    this.thrustPolygon.lineTo(thrustWidth / 2, 0);
    this.thrustPolygon.lineTo(0, thrustHeight);
    this.thrustPolygon.closePath();
    this.thrustPolygon.fillPath();
    this.thrustPolygon.setVisible(false);
    this.gameObject.add(this.thrustPolygon);
    Logger.info(LOGGER_SOURCE, `Thrust graphics added for ${ownerId}.`);
  }

  /**
   * Updates the rocket's visual representation to match its physics body.
   * @param delta The time elapsed since the last frame in milliseconds.
   */
  update(delta: number): void {
    // ADD Direct setting from physics body
    if (this.body) {
      this.gameObject.x = this.body.position.x;
      this.gameObject.y = this.body.position.y;
      this.gameObject.rotation = this.body.angle;
    }

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
