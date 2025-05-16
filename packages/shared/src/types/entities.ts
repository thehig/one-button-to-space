import Matter from "matter-js";

/**
 * Base properties for any game entity that is represented in the physics world
 * and might have a visual representation and server state.
 */
export interface IGameEntity {
  id: string; // Unique identifier (e.g., Colyseus sessionId for players, or a UUID for other entities)
  entityType: string; // e.g., 'rocket', 'debris', 'planet'

  // Position and orientation are primarily driven by the physics body,
  // but might be stored here for state synchronization or if the entity isn't always in physics.
  x?: number;
  y?: number;
  angle?: number; // Radians

  // Link to the physics body, if one exists for this entity
  // This would typically not be part of the synchronized schema directly,
  // but used server-side and potentially client-side to link game logic to physics.
  // physicsBodyId?: number | string; // Reference to Matter.Body.id
}

export interface IRocketEntity extends IGameEntity {
  entityType: "rocket";
  playerId?: string; // sessionId of the player controlling this rocket
  fuel: number; // 0 to 100 (or other max value)
  health: number; // 0 to 100
  // Specific rocket properties
  engineForce: number;
  maneuveringForce: number;
  maxFuel: number;
  // Potentially cargo, mission status etc.
}

export interface IDebrisEntity extends IGameEntity {
  entityType: "debris";
  size: "small" | "medium" | "large";
  lifespan?: number; // Optional: time in ms before it despawns, if applicable
}

// Example for a static celestial body entity, extending IGameEntity
// This links to the ICelestialBody in PhysicsEngine but represents it as a game entity for consistency
export interface IPlanetEntity extends IGameEntity {
  entityType: "planet";
  mass: number;
  radius: number;
  // gravitationalPull: number; // Or derive from mass
  hasAtmosphere: boolean;
}

// Add more entity types as needed...
