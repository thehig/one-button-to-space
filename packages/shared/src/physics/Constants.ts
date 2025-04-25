/**
 * Shared physics constants used by both client and server.
 */

export const MAX_PLAYERS = 256;

export const G = 0.005; // Gravitational constant (adjust for gameplay)
export const DRAG_COEFFICIENT = 0.01; // Air resistance coefficient (adjust for gameplay)

// Constants for player physics body used on server and potentially client prediction
export const PLAYER_THRUST_FORCE = 0.005;
export const PLAYER_MASS = 10; // Mass of the player rocket
export const PLAYER_FRICTION_AIR = 0; // Air friction for the rocket (Set to 0 to rely on custom DRAG_COEFFICIENT logic)
export const PLAYER_ANGULAR_DAMPING = 0.05; // Damping factor to reduce spin over time (0 = no damping, 1 = immediate stop)
export const PLAYER_WIDTH = 40;
export const PLAYER_HEIGHT = 100;

// Physics Engine Settings
export const PHYSICS_TICK_RATE_HZ = 60;
export const PHYSICS_TIMESTEP_MS = 1000 / PHYSICS_TICK_RATE_HZ;

// Client-side only constants (or mainly for client)
export const CLIENT_PHYSICS_CORRECTION_FACTOR = 0.5; // How quickly client physics snaps to server state (0=no snap, 1=instant)

// State Synchronization Thresholds (Server-side)
export const SYNC_THRESHOLD_POSITION = 0.1; // Minimum position change to send update
export const SYNC_THRESHOLD_VELOCITY = 0.05; // Minimum velocity change to send update
export const SYNC_THRESHOLD_ANGLE = 0.01; // Minimum angle change (radians) to send update

// Player Spawning
export const INITIAL_ORBITAL_BUFFER = 100; // Extra distance above atmosphere for initial spawn
export const DEFAULT_SPAWN_AREA_SIZE = 100; // Range for random spawn if no planets exist

// Client-side Device Orientation
export const ORIENTATION_CHANGE_THRESHOLD = 0.5; // Degrees change needed to register update
export const MOUSE_INPUT_COOLDOWN_MS = 1000; // Ignore mouse after real input
export const DEFAULT_SIMULATED_BETA = 45; // Default forward tilt (degrees)
export const DEFAULT_SIMULATED_GAMMA = 0; // Default side tilt (degrees)

// Add other shared constants here as needed (e.g., collision categories if not separate file)
