export const FIXED_TIMESTEP = 1000 / 60; // Milliseconds for 60 FPS
export const GRAVITY = { x: 0, y: 0.98 }; // Example gravity, adjust as needed

// TODO: Define collision categories
export const CollisionCategories = {
  DEFAULT: 0x0001,
  ROCKET: 0x0002,
  DEBRIS: 0x0004,
  PLANET: 0x0008,
  // Add more categories as needed
};

console.log("Physics constants loaded");
