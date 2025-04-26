/**
 * Defines the vertices for the rocket's physics collision shape.
 * Vertices are relative to the body's center (0,0).
 * Must be convex and defined in clockwise or counter-clockwise order.
 */
export const rocketVertices = [
  { x: 0, y: -50 }, // Nose tip
  { x: 10, y: -40 }, // Right shoulder (narrower)
  { x: 10, y: 35 }, // Right side base (narrower)
  { x: 20, y: 50 }, // Right fin tip (slightly narrower)
  { x: -20, y: 50 }, // Left fin tip (slightly narrower)
  { x: -10, y: 35 }, // Left side base (narrower)
  { x: -10, y: -40 }, // Left shoulder (narrower)
];
