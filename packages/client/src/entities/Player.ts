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
  protected interpolationFactor: number = 0.2; // Use protected

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

  // Override the base GameObject updateFromServer if needed for Player specific state
  public override updateFromServer(state: PlayerState): void {
    // Call super.updateFromServer if base class has logic to run
    // super.updateFromServer(state); // Currently GameObject.updateFromServer is empty
    // Handle player-specific state updates from the schema (e.g., cargo, health)
    // if (state.cargo !== undefined) { ... }
    // Note: Physics updates (pos, angle) are handled by updatePhysicsFromServer
    // and interpolation in GameObject.preUpdate. We don't need the lerp logic here anymore.
  }

  // Phaser scene calls this update method on sprites
  // preUpdate(time: number, delta: number): void {
  //   // GameObject.preUpdate handles interpolation.
  //   // Add any Player-specific preUpdate logic here if needed,
  //   // then call super.preUpdate(time, delta);
  //   super.preUpdate(time, delta);
  // }

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
  //     const otherDesc = otherObject ? `GameObject (name: ${otherObject.name})`

  public override destroyGameObject(): void {
    Logger.info(
      LOGGER_SOURCE,
      `Destroying player (ID: ${(this as any).sessionId ?? "Unknown"})`
    );
    super.destroyGameObject();
  }
}
