/**
 * Defines collision categories and masks for Matter.js physics bodies.
 * Matter.js uses bitmasks for collision filtering.
 * A body A collides with body B if:
 * (A.collisionFilter.mask & B.collisionFilter.category) !== 0
 * AND
 * (B.collisionFilter.mask & A.collisionFilter.category) !== 0
 */

export const CollisionCategories = {
  NONE: 0x0000,
  DEFAULT: 0x0001, // Matter.js default category
  ROCKET: 0x0002,
  DEBRIS: 0x0004,
  PLANET_SURFACE: 0x0008,
  STATIC_ENVIRONMENT: 0x0010, // For general static world elements like ground, boundaries
  // Add more categories as needed, e.g., CARGO_ITEM, SATELLITE, etc.
};

export const CollisionMasks = {
  // ROCKET collides with DEBRIS, PLANET_SURFACE, STATIC_ENVIRONMENT
  ROCKET:
    CollisionCategories.DEBRIS |
    CollisionCategories.PLANET_SURFACE |
    CollisionCategories.STATIC_ENVIRONMENT,

  // DEBRIS collides with ROCKET, other DEBRIS, PLANET_SURFACE, STATIC_ENVIRONMENT
  DEBRIS:
    CollisionCategories.ROCKET |
    CollisionCategories.DEBRIS |
    CollisionCategories.PLANET_SURFACE |
    CollisionCategories.STATIC_ENVIRONMENT,

  // PLANET_SURFACE (typically static) collides with ROCKET, DEBRIS
  PLANET_SURFACE: CollisionCategories.ROCKET | CollisionCategories.DEBRIS,

  // STATIC_ENVIRONMENT (typically static) collides with ROCKET, DEBRIS
  STATIC_ENVIRONMENT: CollisionCategories.ROCKET | CollisionCategories.DEBRIS,

  // DEFAULT mask: collides with everything except NONE. Often, dynamic objects will have more specific masks.
  // Static objects might use CATEGORY_DEFAULT and MASK_ALL if they should block everything,
  // or a more specific category if they are a special type of static object.
  DEFAULT: 0xffff,
  ALL: 0xffff, // Collide with all categories
  NONE: 0x0000, // Collide with nothing
};

/**
 * Convenience helper to create a collision filter object.
 * @param category The category bit for this body.
 * @param mask The mask bits defining what this body collides with.
 * @param group An optional group ID. If two bodies have the same positive group ID, they always collide. If they have the same negative group ID, they never collide. Group takes precedence over category/mask.
 * @returns A Matter.js ICollisionFilter object.
 */
export function createCollisionFilter(
  category: number,
  mask: number,
  group: number = 0
): Matter.ICollisionFilter {
  return {
    category,
    mask,
    group,
  };
}
