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
    super(world, x, y, "rocket", undefined, {
      label: isCurrentPlayer
        ? `Player_Local_${sessionId}`
        : `Player_Remote_${sessionId}`,
      mass: config.mass,
      friction: config.friction,
      frictionAir: config.frictionAir,
      restitution: config.restitution,
      collisionFilter: {
        category: config.collisionCategory,
        mask: config.collisionMask,
      },
      vertices: Array.from(config.vertices).map((v: VectorSchema) => ({
        x: v.x,
        y: v.y,
      })),
    });

    // Store original texture dimensions
    const originalWidth = this.width;
    const originalHeight = this.height;

    // Calculate body dimensions (using user's existing code)
    const { x: minX, y: minY } = (this.body as Matter.Body).bounds.min;
    const { x: maxX, y: maxY } = (this.body as Matter.Body).bounds.max;
    const bodyWidth = maxX - minX;
    const bodyHeight = maxY - minY;

    // Calculate scale factors
    const scaleX = bodyWidth / originalWidth;
    const scaleY = bodyHeight / originalHeight;

    // Apply scale factors instead of setDisplaySize
    this.setScale(scaleX, scaleY);
    // Then scale UP the body by the inverse amount to keep the physics calculations correct
    Matter.Body.scale(this.body as Matter.Body, 1 / scaleX, 1 / scaleY);

    // Calculate the physics center relative to the body's top-left corner
    const relativeCenterX = (this.body as Matter.Body).position.x - minX;
    const relativeCenterY = (this.body as Matter.Body).position.y - minY;

    // Normalize the relative center to get the origin (0-1 range)
    // Avoid division by zero if dimensions are zero
    const originX = bodyWidth > 0 ? relativeCenterX / bodyWidth : 0.5;
    const originY = bodyHeight > 0 ? relativeCenterY / bodyHeight : 0.5;

    // Set the sprite's origin to align its visual center with the body's center of mass
    this.setOrigin(originX, originY);

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
  // Override destroyGameObject to clean up
  public override destroyGameObject(): void {
    // Destroy debug graphics
    if (this.debugGraphics) {
      this.debugGraphics.destroy();
      this.debugGraphics = null;
    }
    Logger.info(LOGGER_SOURCE, `Destroying player (ID: ${this.sessionId})`);
    super.destroyGameObject(); // Call base class destroy
  }
}
