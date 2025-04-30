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

export class Player extends GameObject {
  public isCurrentPlayer: boolean;
  private _isThrusting: boolean = false;
  public sessionId: string; // Add sessionId property

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
    const physicsOptions = {
      type: "vertices",
      verts: [bodyVertices], // Use converted vertices from config
      mass: config.mass,
      friction: config.friction,
      frictionAir: config.frictionAir,
      restitution: config.restitution,
      collisionFilter: {
        // @ts-ignore - Acknowledge likely build/linking issue
        category: config.collisionCategory,
        // @ts-ignore - Acknowledge likely build/linking issue
        mask: config.collisionMask,
      },
    };

    // --- Apply the custom body AFTER the sprite and default body exist ---
    // The type assertion might be needed if TS still complains
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
    // Scale the main sprite based on config
    const scaleX = config.visualWidth / config.textureWidth;
    const scaleY = config.visualHeight / config.textureHeight;
    this.setScale(scaleX, scaleY);
    this.setDepth(PLAYER_DEPTH); // Use client-side constant

    // --- Create Thruster Sprite --- (Manually managed)
    // Calculate offset based on config
    const thrusterBaseY =
      config.visualHeight * 0.5 + config.thrusterOffsetYAdjust;
    const thrusterYOffset = thrusterBaseY * scaleY + config.visualOffsetY;

    this.thrusterSprite = this.scene.add.sprite(
      this.x, // Initial position, will follow Player
      this.y + thrusterYOffset, // Apply offset relative to player center
      config.thrusterTexture1 // Use texture key from config
    );
    this.thrusterSprite.setOrigin(0.5, 0); // Top-center origin
    this.thrusterSprite.setScale(
      config.thrusterScaleFactor * scaleX,
      config.thrusterScaleFactor * scaleY
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

    // Handle player-specific state updates from the schema
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
    // Calculate offset based on config and current scale
    // Use the stored config instead of scene data
    const config = this.config;
    if (!config) {
      Logger.warn(LOGGER_SOURCE, "Player config missing in preUpdate");
      return;
    }
    const thrusterBaseOffsetY =
      (config.visualHeight * 0.5 + config.thrusterOffsetYAdjust) * scaleY +
      config.visualOffsetY;
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
        showFrame1 ? config.thrusterTexture1 : config.thrusterTexture2
      );
    }
  }

  // --- Helper Methods ---

  private updateThrusterVisual(): void {
    if (this.thrusterSprite) {
      this.thrusterSprite.setVisible(this._isThrusting);
      if (!this._isThrusting) {
        // Reset to default frame when hidden
        // Use the stored config instead of scene data
        const config = this.config;
        if (!config) {
          Logger.warn(
            LOGGER_SOURCE,
            "Player config missing in updateThrusterVisual"
          );
          return;
        }
        this.thrusterSprite.setTexture(config.thrusterTexture1);
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
