import Phaser from "phaser";
import { Vector as MatterVector } from "matter-js";

/**
 * Base class for all interactive game objects in the scene.
 * Extends Phaser's MatterSprite for physics integration.
 */
export abstract class GameObject extends Phaser.Physics.Matter.Sprite {
  constructor(
    world: Phaser.Physics.Matter.World,
    x: number,
    y: number,
    texture: string,
    frame?: string | number,
    options?: Phaser.Types.Physics.Matter.MatterBodyConfig
  ) {
    super(world, x, y, texture, frame, options);

    // Common setup for all game objects
    this.scene.add.existing(this);
  }

  // Common methods for game objects can be added here
  // e.g., handleDamage(amount: number): void;
  // e.g., interact(): void;

  // Override Phaser's update method if needed, but prefer manager-driven updates
  // preUpdate(time: number, delta: number): void {
  //     super.preUpdate(time, delta);
  // }

  /**
   * Method to update the object based on server state.
   * @param state - The state data received from the server.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars
  public updateFromServer(state: any): void {
    // Example: Interpolate position, apply rotation, etc.
    // This should handle syncing state like x, y, angle, vx, vy from server updates
    // Phaser's MatterSprite often handles basic position/angle sync automatically if body is updated.
    // You might need specific logic for velocity or other state fields.
  }

  // Physics interaction methods are inherited from Phaser.Physics.Matter.Sprite
  // Use this.applyForce(), this.setVelocity(), this.setAngle(), this.setAngularVelocity() directly.

  public destroyGameObject(): void {
    // Custom cleanup logic before destroying (e.g., remove from groups)
    this.destroy(); // Call Phaser's destroy method (handles removing body from world)
  }
}
