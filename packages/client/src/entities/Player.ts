import Phaser from "phaser";
import Matter from "matter-js";
import { GameObject } from "../core/GameObject";
import { PlayerState, PlayerConfigSchema, VectorSchema } from "../schema/State"; // Import VectorSchema
import { Logger } from "@one-button-to-space/shared"; // Import Logger & shared CollisionCategory

// Logger Source for this file
const LOGGER_SOURCE = "🧑‍🚀✨";

export class Player extends GameObject {
  public label: string;
  public isCurrentPlayer: boolean;
  private _isThrusting: boolean = false;
  private debugGraphics: Phaser.GameObjects.Graphics | null = null; // For debug drawing

  public sessionId: string; // Add sessionId property
  public latestVx: number = 0; // Store latest server velocity X
  public latestVy: number = 0; // Store latest server velocity Y

  constructor(
    world: Phaser.Physics.Matter.World, // Correct constructor parameter
    x: number,
    y: number,
    sessionId: string, // Use sessionId
    isCurrentPlayer: boolean = false,
    config: PlayerConfigSchema // Add config parameter
  ) {
    // Call the GameObject (Phaser.Physics.Matter.Sprite) constructor
    super(world, x, y, "rocket", undefined);

    // Store original texture dimensions
    const originalWidth = this.width;
    const originalHeight = this.height;

    // Calculate body dimensions from vertices
    const vertices = config.vertices;
    const minX = Math.min(...vertices.map((v) => v.x));
    const maxX = Math.max(...vertices.map((v) => v.x));
    const minY = Math.min(...vertices.map((v) => v.y));
    const maxY = Math.max(...vertices.map((v) => v.y));
    const bodyWidth = maxX - minX;
    const bodyHeight = maxY - minY;

    // Calculate scale factors
    const scaleX = bodyWidth / originalWidth;
    const scaleY = bodyHeight / originalHeight;

    // Apply scale factors (Only affects the size of the Texture/Sprite)
    this.setScale(scaleX, scaleY);

    // *** Re-apply the body definition AFTER scaling and origin setting ***
    // This ensures the client-side physics body matches the intended shape.
    this.setBody(
      {},
      {
        // Pass other relevant options from config again
        mass: config.mass,
        friction: config.friction,
        frictionAir: config.frictionAir,
        restitution: config.restitution,
        collisionFilter: {
          category: config.collisionCategory,
          mask: config.collisionMask,
        },
        // label: this.label, // Use the label already set
        vertices: Array.from(config.vertices).map((v: VectorSchema) => ({
          x: v.x,
          y: v.y,
        })),
      }
    );

    this.label = isCurrentPlayer
      ? `Player_Local_${sessionId}`
      : `Player_Remote_${sessionId}`;

    // --- Set Properties AFTER super() ---
    this.isCurrentPlayer = isCurrentPlayer;
    this.sessionId = sessionId;

    // Attach this GameObject instance to the Matter body for collision identification
    this.body!.gameObject = this;

    // Initialize debug graphics
    this.debugGraphics = this.scene.add.graphics();
    // Optional: Set depth if needed, e.g., this.debugGraphics.setDepth(this.depth + 1);
  }

  // --- Getters/Setters for Thrust State ---
  get isThrusting(): boolean {
    return this._isThrusting;
  }

  set isThrusting(value: boolean) {
    if (this._isThrusting === value) return; // No change
    this._isThrusting = value;
  }

  // Override the base GameObject updateFromServer
  public override updateFromServer(state: PlayerState): void {
    super.updateFromServer(state); // Base handles non-physics/non-interpolation state if any

    // --- Update Velocity Cache ---
    // Store the latest authoritative velocity from the server state
    this.latestVx = state.vx;
    this.latestVy = state.vy;

    // --- Update Other Player-Specific State ---
    if (
      state.isThrusting !== undefined &&
      this.isThrusting !== state.isThrusting
    ) {
      this.isThrusting = state.isThrusting;
    }
  }

  // Override preUpdate for interpolation
  preUpdate(time: number, delta: number): void {
    // Draw debug dots BEFORE interpolation shifts the visual position
    if (this.debugGraphics && this.body) {
      this.debugGraphics.clear();

      // Dot for texture center (visual center using getCenter())
      const visualCenter = this.getCenter(); // Center after scale/rotation
      this.debugGraphics.fillStyle(0xff0000, 1); // Red for texture center
      this.debugGraphics.fillCircle(visualCenter.x, visualCenter.y, 3);

      // Dot for physics body center (center of mass)
      const bodyCenter = this.body.position;
      this.debugGraphics.fillStyle(0x0000ff, 1); // Blue for body center
      this.debugGraphics.fillCircle(bodyCenter.x, bodyCenter.y, 3);
    }

    super.preUpdate(time, delta); // IMPORTANT: Call base for interpolation

    // Removed thruster logic
  }

  // --- Helper Methods ---
  // Changed from destroyGameObject to match Phaser standard
  public override destroy(fromScene?: boolean): void {
    Logger.trace(LOGGER_SOURCE, `Player destroy called for ${this.sessionId}.`);
    // Destroy debug graphics
    if (this.debugGraphics) {
      Logger.trace(
        LOGGER_SOURCE,
        `Destroying debug graphics for ${this.sessionId}.`
      );
      this.debugGraphics.destroy();
      this.debugGraphics = null;
    }
    Logger.info(LOGGER_SOURCE, `Destroying player (ID: ${this.sessionId})`);
    super.destroy(fromScene); // Call base class destroy (which calls Phaser's destroy)
    Logger.trace(
      LOGGER_SOURCE,
      `Player super.destroy finished for ${this.sessionId}.`
    );
  }
}
