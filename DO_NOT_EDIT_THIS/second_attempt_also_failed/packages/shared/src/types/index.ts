/**
 * Defines shared constants used throughout the application.
 */
export const Constants = {
  // ... (other constants)
} as const;

/**
 * Enum for collision categories used by Matter.js physics.
 * Values must be powers of 2.
 */
export enum CollisionCategory {}
// ... (other categories)

/**
 * Represents the physics state data sent from the server for an entity.
 * This is used in the 'physics_update' message.
 */
export type PhysicsStateUpdate = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  angularVelocity: number;
  isSleeping: boolean;
  // Add other relevant physics properties if needed (e.g., scale, specific forces)
};

/**
 * Represents the structure of player input messages sent to the server.
 */
// ... (PlayerInputMessage type)
