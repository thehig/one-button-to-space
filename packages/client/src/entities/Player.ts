import Phaser from "phaser";
import { Body as MatterBody, Vector as MatterVector } from "matter-js";
import { GameObject } from "../core/GameObject";
import { PlayerState, PlayerConfigSchema, VectorSchema } from "../schema/State"; // Import VectorSchema
// @ts-ignore - Allow importing from shared potentially outside rootDir
import { Logger, CollisionCategory } from "@one-button-to-space/shared"; // Import Logger & shared CollisionCategory

// Logger Source for this file
const LOGGER_SOURCE = "🧑‍🚀✨";

// --- Client-Side ONLY Constants ---
const THRUSTER_FLICKER_RATE = 50; // ms per thruster animation frame
const PLAYER_DEPTH = 10; // Render depth
const THRUSTER_DEPTH = 9; // Render depth (behind player)
const VISUAL_WIDTH = 40; // Target visual width
const VISUAL_HEIGHT = 100; // Target visual height
const TEXTURE_WIDTH = 64; // Actual width of the rocket texture frame
const TEXTURE_HEIGHT = 128; // Actual height of the rocket texture frame
const THRUSTER_TEXTURE_1 = "thruster1"; // Texture key for thruster frame 1
const THRUSTER_TEXTURE_2 = "thruster2"; // Texture key for thruster frame 2
const THRUSTER_OFFSET_Y_ADJUST = 5; // Fine-tune thruster vertical position relative to bottom center
const VISUAL_OFFSET_Y = 0; // Optional global offset for the visual sprite
const THRUSTER_SCALE_FACTOR = 1.0; // Scale factor for the thruster sprite relative to player

export class Player extends GameObject {
  public isCurrentPlayer: boolean;
  private _isThrusting: boolean = false;
  public sessionId: string; // Add sessionId property
  public latestVx: number = 0; // Store latest server velocity X
  public latestVy: number = 0; // Store latest server velocity Y

  // Store the config received from the server
  private config: PlayerConfigSchema;

  // Thruster sprite reference
  private thrusterSprite?: Phaser.GameObjects.Sprite;

  constructor(
    world: Phaser.Physics.Matter.World, // Correct constructor parameter
    x: number,
    y: number,
    sessionId: string, // Use sessionId
    isCurrentPlayer: boolean = false,
    config: PlayerConfigSchema // Add config parameter
  ) {
    // Call the GameObject (Phaser.Physics.Matter.Sprite) constructor FIRST
    // Pass minimal options, let setBody handle the complex shape
    super(world, x, y, "rocket", undefined, {
      label: isCurrentPlayer
        ? `Player_Local_${sessionId}`
        : `Player_Remote_${sessionId}`,
      // No shape here initially
    });

    // --- Define Physics Options AFTER super() ---
    // Convert ArraySchema<VectorSchema> back to Array<{x,y}> for Matter
    const bodyVertices = Array.from(config.vertices).map((v: VectorSchema) => ({
      x: v.x,
      y: v.y,
    }));

    // Restructure physicsOptions for setBody
    const physicsOptions: Phaser.Types.Physics.Matter.MatterBodyConfig = {
      // Removed: type: "vertices",
      vertices: bodyVertices, // Pass vertices directly
      mass: config.mass,
      friction: config.friction,
      frictionAir: config.frictionAir,
      restitution: config.restitution,
      collisionFilter: {
        // @ts-ignore - Kept for now, but might be removable if types align
        category: config.collisionCategory,
        // @ts-ignore - Kept for now, but might be removable if types align
        mask: config.collisionMask,
      },
    };

    // --- Apply the custom body AFTER the sprite and default body exist ---
    this.setBody(
      physicsOptions as Phaser.Types.Physics.Matter.MatterSetBodyConfig
    );

    // --- Set Properties AFTER super() and setBody() ---
    this.isCurrentPlayer = isCurrentPlayer;
    this.sessionId = sessionId;
    this.config = config; // Store the received config

    // --- Visual Setup (on `this` Player object) ---
    const rocketColor = this._generateColorFromId(this.sessionId);
    this.setTint(rocketColor);
    // Scale the main sprite based on constants
    const scaleX = VISUAL_WIDTH / TEXTURE_WIDTH;
    const scaleY = VISUAL_HEIGHT / TEXTURE_HEIGHT;
    this.setScale(scaleX, scaleY);
    this.setDepth(PLAYER_DEPTH); // Use client-side constant

    // --- Create Thruster Sprite --- (Manually managed)
    // Calculate offset based on constants
    const thrusterBaseY = VISUAL_HEIGHT * 0.5 + THRUSTER_OFFSET_Y_ADJUST;
    const thrusterYOffset = thrusterBaseY * scaleY + VISUAL_OFFSET_Y;

    this.thrusterSprite = this.scene.add.sprite(
      this.x, // Initial position, will follow Player
      this.y + thrusterYOffset, // Apply offset relative to player center
      THRUSTER_TEXTURE_1 // Use constant texture key
    );
    this.thrusterSprite.setOrigin(0.5, 0); // Top-center origin
    this.thrusterSprite.setScale(
      THRUSTER_SCALE_FACTOR * scaleX,
      THRUSTER_SCALE_FACTOR * scaleY
    );
    this.thrusterSprite.setDepth(THRUSTER_DEPTH); // Use client-side constant
    this.thrusterSprite.setVisible(false); // Initially hidden

    // Attach this GameObject instance to the Matter body for collision identification
    (this.body as any).gameObject = this; // Use 'as any' to add custom property
  }

  // --- Getters/Setters for Thrust State ---
  get isThrusting(): boolean {
    return this._isThrusting;
  }

  set isThrusting(value: boolean) {
    if (this._isThrusting === value) return; // No change
    this._isThrusting = value;
    this.updateThrusterVisual();
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

  // Override preUpdate for interpolation AND custom logic like thruster updates
  preUpdate(time: number, delta: number): void {
    super.preUpdate(time, delta); // IMPORTANT: Call base for interpolation

    if (!this.thrusterSprite) return; // Guard if thruster not created

    // --- Update Thruster Position --- (Follow Player)
    const scaleY = this.scaleY; // Use current visual scale
    // Calculate offset based on constants and current scale
    const thrusterBaseOffsetY =
      (VISUAL_HEIGHT * 0.5 + THRUSTER_OFFSET_Y_ADJUST) * scaleY +
      VISUAL_OFFSET_Y;
    // Calculate position relative to the rotated player
    const angle = this.rotation;
    const offsetX = Math.sin(angle) * thrusterBaseOffsetY;
    const offsetY = -Math.cos(angle) * thrusterBaseOffsetY;

    this.thrusterSprite.setPosition(this.x + offsetX, this.y + offsetY);
    this.thrusterSprite.setRotation(angle); // Match player rotation

    // --- Update Thruster Animation --- (If thrusting)
    if (this._isThrusting) {
      // Simple flicker based on current time
      const showFrame1 = Math.floor(time / THRUSTER_FLICKER_RATE) % 2 === 0;
      this.thrusterSprite.setTexture(
        showFrame1 ? THRUSTER_TEXTURE_1 : THRUSTER_TEXTURE_2 // Use constants
      );
    }
  }

  // --- Helper Methods ---

  private updateThrusterVisual(): void {
    if (this.thrusterSprite) {
      this.thrusterSprite.setVisible(this._isThrusting);
      if (!this._isThrusting) {
        // Reset to default frame when hidden
        this.thrusterSprite.setTexture(THRUSTER_TEXTURE_1); // Use constant
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
    return color;
  }

  // --- Collision Handling ---
  public onCollisionStart(
    otherObject: GameObject | undefined,
    pair: Matter.Pair
  ): void {
    // Type assertion needed because Matter.Body doesn't inherently know about GameObject
    // The other body involved in the collision might not have a gameObject property
    // if it's a static world boundary or a sensor, etc.
    const otherGameObject = (pair.bodyB as any)?.gameObject as
      | GameObject
      | undefined;
    const otherDesc =
      otherGameObject?.name ?? (pair.bodyB.label || "world boundary"); // Improved description
    Logger.info(
      LOGGER_SOURCE,
      `Player (ID: ${this.sessionId}) collision START with ${otherDesc}`,
      { pair: pair.id } // Log pair ID for debugging
    );
    // Example: Play sound, show effect
  }

  // Override destroyGameObject to clean up thruster sprite
  public override destroyGameObject(): void {
    Logger.info(LOGGER_SOURCE, `Destroying player (ID: ${this.sessionId})`);
    this.thrusterSprite?.destroy(); // Destroy the thruster sprite
    this.thrusterSprite = undefined; // Clear reference
    super.destroyGameObject(); // Call base class destroy
  }
}
