import Phaser from "phaser";
import { Vector as MatterVector } from "matter-js";
import type { PhysicsStateUpdate } from "@one-button-to-space/shared"; // Import the type
import { Logger } from "@one-button-to-space/shared"; // Import the Logger

/**
 * Base class for all interactive game objects in the scene.
 * Extends Phaser's MatterSprite for physics integration.
 */
export abstract class GameObject extends Phaser.Physics.Matter.Sprite {
  // Keep track of target physics state for interpolation/smoothing
  protected targetX: number;
  protected targetY: number;
  protected targetAngle: number;
  protected interpolationFactor: number = 0.2; // Default interpolation factor

  constructor(
    world: Phaser.Physics.Matter.World,
    x: number,
    y: number,
    texture: string,
    frame?: string | number,
    options?: Phaser.Types.Physics.Matter.MatterBodyConfig
  ) {
    super(world, x, y, texture, frame, options);

    // Initialize target state to initial state
    this.targetX = x;
    this.targetY = y;
    this.targetAngle = this.rotation; // Initial rotation

    // Common setup for all game objects
    this.scene.add.existing(this);
  }

  // Common methods for game objects can be added here
  // e.g., handleDamage(amount: number): void;
  // e.g., interact(): void;

  /**
   * Method to update the object based on server state snapshot (schema updates).
   * Primarily handles non-physics properties or initial state.
   * @param state - The state data received from the server's schema.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars
  public updateFromServer(state: any): void {
    // Subclasses might override this for specific non-physics state updates
    // (e.g., player cargo, planet color based on schema)
    // Physics-related state (position, velocity, angle) is primarily handled by
    // updatePhysicsFromServer and client-side interpolation/prediction.
  }

  /**
   * Method to update the object based on frequent physics updates from the server.
   * Sets target values for interpolation.
   * @param physicsData - The physics state data received from the server message.
   */
  public updatePhysicsFromServer(physicsData: PhysicsStateUpdate): void {
    // Ensure data is valid before logging or assigning
    // Use current target as default if property is missing/invalid
    const safeX =
      typeof physicsData.x === "number" ? physicsData.x : this.targetX;
    const safeY =
      typeof physicsData.y === "number" ? physicsData.y : this.targetY;
    const safeAngle =
      typeof physicsData.angle === "number"
        ? physicsData.angle
        : this.targetAngle;

    // Log at trace level - Use the safe values for logging
    Logger.trace(
      `${this.constructor.name}-${this.name}`,
      `Updating physics targets: x=${safeX.toFixed(2)}, y=${safeY.toFixed(
        2
      )}, angle=${safeAngle.toFixed(2)}`
    );

    // Update target physics state using the safe values
    this.targetX = safeX;
    this.targetY = safeY;
    this.targetAngle = safeAngle;

    // Optionally apply velocity/angularVelocity directly IF NOT interpolating
    // or if prediction requires it.
    // Be cautious applying both interpolation and direct velocity setting.
    // if (this.body) { // Check if body exists
    //   this.setVelocity(physicsData.vx, physicsData.vy);
    //   this.setAngularVelocity(physicsData.angularVelocity);
    //   // Handle sleeping state if needed
    //   if (physicsData.isSleeping !== undefined) {
    //      Matter.Sleeping.set(this.body as Matter.Body, physicsData.isSleeping);
    //   }
    // }
  }

  // Override Phaser's preUpdate for interpolation
  preUpdate(time: number, delta: number): void {
    super.preUpdate(time, delta); // Essential for sprite updates

    // --- Client-Side Interpolation --- //
    // Smoothly move the visual representation towards the target server position/angle
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

    // Interpolate angle smoothly using RotateTo
    const newAngle = Phaser.Math.Angle.RotateTo(
      this.rotation,
      this.targetAngle,
      this.interpolationFactor * 0.5
    ); // Slower angle interpolation feels better
    this.setRotation(newAngle);
  }

  public destroyGameObject(): void {
    // Custom cleanup logic before destroying (e.g., remove from groups)
    this.destroy(); // Call Phaser's destroy method (handles removing body from world)
  }
}
