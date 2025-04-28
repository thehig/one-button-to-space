import Phaser from "phaser";
import { GameObject } from "../core/GameObject";
import {
  PhysicsManager,
  CollisionCategories,
} from "../managers/PhysicsManager"; // Import PhysicsManager for categories
import { PlayerState } from "../schema/State"; // Corrected path
import { Logger } from "@one-button-to-space/shared"; // Import Logger

// Logger Source for this file
const LOGGER_SOURCE = "🧑‍🚀✨";

export class Player extends GameObject {
  public isCurrentPlayer: boolean;
  private targetX: number;
  private targetY: number;
  private interpolationFactor: number = 0.2; // Adjust for smoother or snappier movement

  constructor(
    world: Phaser.Physics.Matter.World,
    x: number,
    y: number,
    texture: string,
    frame: string | number | undefined,
    options?: Phaser.Types.Physics.Matter.MatterBodyConfig,
    isCurrentPlayer: boolean = false
  ) {
    // --- Matter Body Configuration ---
    // Server should ideally dictate the authoritative body shape/size.
    // Client creates a visual representation matching the server's definition.
    const radius = 16; // Example radius - should match server definition
    const bodyOptions: Phaser.Types.Physics.Matter.MatterBodyConfig = {
      label: isCurrentPlayer ? "Player_Local" : "Player_Remote",
      shape: { type: "circle", radius: radius },
      isStatic: false, // Players move
      friction: 0.1,
      frictionAir: 0.05, // Some air drag
      restitution: 0.1, // Less bouncy
      // Mass is often calculated automatically based on density/area
      // density: 0.001
      collisionFilter: {
        category: CollisionCategories.PLAYER,
        // Collide with walls, enemies, maybe items, but not other players directly?
        mask:
          CollisionCategories.WALL |
          CollisionCategories.ENEMY |
          CollisionCategories.PROJECTILE_ENEMY, // Example
      },
    };

    super(world, x, y, texture, frame, bodyOptions);

    this.isCurrentPlayer = isCurrentPlayer;
    this.targetX = x;
    this.targetY = y;

    // --- Visual Setup ---
    this.setDisplaySize(radius * 2, radius * 2); // Match visual size to physics body
    if (this.isCurrentPlayer) {
      this.setTint(0x00ff00); // Tint local player green (example)
    } else {
      this.setTint(0xff0000); // Tint remote players red (example)
    }

    // Disable default Matter physics updates for position/rotation if interpolating
    this.setIgnoreGravity(true); // Gravity likely handled server-side or is top-down (0)

    // Attach this GameObject instance to the Matter body for collision identification
    (this.body as any).gameObject = this;

    // Logger.debug(LOGGER_SOURCE, `Player created: ${this.name}`, { isLocal: isCurrentPlayer }); // Example debug log
  }

  // Override the base GameObject updateFromServer
  public override updateFromServer(state: PlayerState): void {
    super.updateFromServer(state);

    // Define lerpFactor outside the blocks
    const lerpFactor = 0.2;

    // Check properties before interpolating
    if (state.x !== undefined && state.y !== undefined) {
      this.x = Phaser.Math.Linear(this.x, state.x, lerpFactor);
      this.y = Phaser.Math.Linear(this.y, state.y, lerpFactor);
    }
    if (state.angle !== undefined) {
      this.rotation = Phaser.Math.Angle.RotateTo(
        this.rotation,
        state.angle,
        lerpFactor * 0.5
      );
    }

    // Apply velocity directly if needed (less common when interpolating position)
    // if (state.vx !== undefined && state.vy !== undefined && this.body) {
    //   this.setVelocity(state.vx, state.vy);
    // }
    // if (state.angularVelocity !== undefined && this.body) {
    //   this.setAngularVelocity(state.angularVelocity);
    // }

    // Update other player-specific state if necessary (e.g., cargo, health)
    // if (state.cargo !== undefined) { ... }
  }

  // Phaser scene calls this update method on sprites
  preUpdate(time: number, delta: number): void {
    super.preUpdate(time, delta); // Essential for sprite updates

    // --- Client-Side Interpolation ---
    // Smoothly move the visual representation towards the target server position
    const newX = Phaser.Math.Linear(
      this.x,
      this.targetX,
      this.interpolationFactor
    );
    const newY = Phaser.Math.Linear(
      this.y,
      this.targetY,
      this.interpolationFactor
    );
    this.setPosition(newX, newY);

    // --- Client-Side Prediction (Optional & Advanced) ---
    // If this is the current player, you could apply inputs locally
    // for immediate feedback, then reconcile with server state later.
    // This is complex to implement correctly.
    // if (this.isCurrentPlayer) {
    //     // Apply predicted movement based on InputManager state
    // }

    // --- Other Client-Side Logic ---
    // Handle animations, particle effects, etc.
  }

  // --- Collision Handling Examples ---
  public onCollisionStart(
    otherObject: GameObject | undefined,
    pair: Matter.Pair
  ): void {
    const otherDesc = otherObject
      ? `GameObject (name: ${otherObject.name})`
      : "world boundary";
    Logger.info(
      // Replaced console.log
      LOGGER_SOURCE,
      `Player (ID: ${
        (this as any).sessionId ?? this.name
      }) collision START with ${otherDesc}`
    );
    // Example: Play sound, show effect
  }

  // public onCollisionActive(otherObject: GameObject | undefined, pair: Matter.Pair): void {
  //     // Handle continuous collision
  // }

  // public onCollisionEnd(otherObject: GameObject | undefined, pair: Matter.Pair): void {
  //     const otherDesc = otherObject ? `GameObject (name: ${otherObject.name})` : "world boundary";
  //     Logger.info(LOGGER_SOURCE, `Player (ID: ${(this as any).sessionId ?? this.name}) collision END with ${otherDesc}`);
  // }

  public override destroyGameObject(): void {
    Logger.info(
      // Replaced console.log
      LOGGER_SOURCE,
      `Destroying player (ID: ${(this as any).sessionId ?? "Unknown"})`
    );
    // Add any player-specific cleanup before calling super
    super.destroyGameObject();
  }
}
