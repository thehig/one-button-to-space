import Phaser from "phaser";
import { GameObject } from "../core/GameObject";
import {
  PhysicsManager,
  CollisionCategories,
} from "../managers/PhysicsManager"; // Import PhysicsManager for categories
import { PlayerState } from "../../../server/src/schema/GameState"; // Verify path

export class Player extends GameObject {
  private isCurrentPlayer: boolean;
  private targetX: number;
  private targetY: number;
  private interpolationFactor: number = 0.2; // Adjust for smoother or snappier movement

  constructor(
    world: Phaser.Physics.Matter.World,
    x: number,
    y: number,
    texture: string,
    frame: string | number | undefined,
    isCurrentPlayer: boolean = false
  ) {
    // --- Matter Body Configuration ---
    // Server should ideally dictate the authoritative body shape/size.
    // Client creates a visual representation matching the server's definition.
    const radius = 16; // Example radius - should match server definition
    const options: Phaser.Types.Physics.Matter.MatterBodyConfig = {
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

    super(world, x, y, texture, frame, options);

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
  }

  // Override the base GameObject updateFromServer
  public override updateFromServer(state: PlayerState): void {
    // Store the target position from the server state
    this.targetX = state.x;
    this.targetY = state.y;

    // Immediately set non-interpolated properties if needed
    // e.g., this.setAngle(Phaser.Math.RadToDeg(state.angle));
    // e.g., this.setVisible(state.visible);
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
  // Implement these methods if PhysicsManager calls them
  public onCollisionStart(
    otherObject: GameObject | undefined,
    pair: Matter.Pair
  ): void {
    console.log(
      `${this.body.label} started collision with ${
        otherObject?.body?.label || "world"
      }`
    );
    // Example: Play sound, show effect
  }

  // public onCollisionActive(otherObject: GameObject | undefined, pair: Matter.IPair): void {
  //     // Handle continuous collision
  // }

  // public onCollisionEnd(otherObject: GameObject | undefined, pair: Matter.IPair): void {
  //     console.log(`${this.body.label} ended collision with ${otherObject?.body?.label || 'world'}`);
  // }

  public override destroyGameObject(): void {
    console.log(`Destroying player ${this.body.label}`);
    // Add any player-specific cleanup before calling super
    super.destroyGameObject();
  }
}
