/**
 * Shared physics constants used by both client and server.
 */

export const MAX_PLAYERS = 256;

// --- World Physics ---
export const G = 0.005; // Gravitational constant (adjust for gameplay)
export const DRAG_COEFFICIENT = 0.01; // Air resistance coefficient (adjust for gameplay)
export const DEFAULT_ATMOSPHERE_HEIGHT = 50; // Default planet atmosphere height if not specified

// --- Player Physics ---
export const PLAYER_THRUST_FORCE = 0.0005;
export const PLAYER_MASS = 10; // Mass of the player rocket
export const PLAYER_FRICTION = 0.05; // Surface friction (e.g., when landed)
export const PLAYER_FRICTION_AIR = 0; // Air friction for the rocket (Set to 0 to rely on custom DRAG_COEFFICIENT logic)
export const PLAYER_RESTITUTION = 0.3; // Bounciness (0=none, 1=perfectly elastic)
export const PLAYER_ANGULAR_DAMPING = 0.05; // Damping factor to reduce spin over time (0 = no damping, 1 = immediate stop)
export const ANGULAR_VELOCITY_SNAP_THRESHOLD = 0.0001; // Threshold below which angular velocity snaps to 0
export const PLAYER_WIDTH = 40; // Visual/approximate width
export const PLAYER_HEIGHT = 100; // Visual/approximate height

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

/**
 * Defines shared collision categories for Matter.js physics bodies.
 * Uses powers of 2 for bitmasking.
 */
export const CollisionCategory = {
  ROCKET: 0x0001, // Category 1 (bit 0)
  GROUND: 0x0002, // Category 2 (bit 1)
  // Add more categories later (e.g., DEBRIS: 0x0004, LANDING_PAD: 0x0008)
};

// --- Physics Engine Settings ---
export const PHYSICS_TICK_RATE_HZ = 60;
export const PHYSICS_TIMESTEP_MS = 1000 / PHYSICS_TICK_RATE_HZ;

// --- Player Spawning ---
export const INITIAL_ORBITAL_BUFFER = 100; // Extra distance above atmosphere for initial spawn
export const DEFAULT_SPAWN_AREA_SIZE = 100; // Range for random spawn if no planets exist

// Client-side Device Orientation
export const ORIENTATION_CHANGE_THRESHOLD = 0.5; // Degrees change needed to register update
export const MOUSE_INPUT_COOLDOWN_MS = 1000; // Ignore mouse after real input
export const DEFAULT_SIMULATED_BETA = 45; // Default forward tilt (degrees)
export const DEFAULT_SIMULATED_GAMMA = 0; // Default side tilt (degrees)

// -- Client-Side Prediction Correction Tuning --
// These constants control how the client corrects its predicted physics state
// based on authoritative updates received from the server.
//
// Relationship:
// 1. The difference between the client's prediction and the server's state is calculated.
// 2. If this difference EXCEEDS the relevant THRESHOLD (e.g., `CLIENT_POSITION_CORRECTION_THRESHOLD`),
//    a correction is applied.
// 3. The magnitude of the correction applied in that step is determined by the `CLIENT_PHYSICS_CORRECTION_FACTOR`.
//    A lower FACTOR results in smoother, slower corrections, reducing visual jitter but
//    potentially allowing more temporary divergence from the server state.
//    A higher FACTOR snaps the client state closer to the server state more quickly,
//    but can cause oscillations if the difference is consistently above the threshold.
//
// Goal: Use THRESHOLDS to prevent corrections for minor, insignificant jitter/float differences,
//       and use a low FACTOR to make necessary corrections smooth.
//
// NEW: Thresholds for applying corrections

export const CLIENT_PHYSICS_CORRECTION_FACTOR = 0.15; // How quickly client physics snaps to server state (0=no snap, 1=instant)
export const CLIENT_POSITION_CORRECTION_THRESHOLD = 0.1; // Min position difference (pixels) to trigger correction
export const CLIENT_VELOCITY_CORRECTION_THRESHOLD = 0.05; // Min velocity difference (pixels/step?) to trigger correction
export const CLIENT_ANGLE_CORRECTION_THRESHOLD = 0.01; // Min angle difference (radians) to trigger correction

// -- Server-Side State Synchronization Tuning --
// These constants determine the minimum change required in a player's state
// on the server before an update for that property is broadcast to clients.
//
// Purpose: Reduce network traffic by avoiding sending updates for very small,
// potentially insignificant changes in position, velocity, or angle.
// If a player's state variable has changed by LESS than the corresponding
// threshold since the last acknowledged/sent update for that player,
// the server may skip sending that variable in the current update packet.
//
// Note: Setting these too high can lead to noticeable lag or teleporting for
// other players on the client-side. Setting them too low increases bandwidth usage.
//
// State Synchronization Thresholds (Server-side)
export const SYNC_THRESHOLD_POSITION = 0.1; // Minimum position change (pixels) to send update
export const SYNC_THRESHOLD_VELOCITY = 0.05; // Minimum velocity change (pixels/step?) to send update
export const SYNC_THRESHOLD_ANGLE = 0.01; // Minimum angle change (radians) to send update
