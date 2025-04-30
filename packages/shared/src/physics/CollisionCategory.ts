/**
 * Defines the collision categories for Matter.js physics bodies.
 * Each category is a bitmask.
 */
export const CollisionCategory = {
  ROCKET: 0x0001, // Category 1 (bit 0)
  GROUND: 0x0002, // Category 2 (bit 1)
  PLAYER: 0x0004, // Category 3 (bit 2)
  // Add more categories later (e.g., LANDING_PAD: 0x0008, PROJECTILE: 0x0010)
};
