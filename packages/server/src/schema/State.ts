import { Schema, MapSchema, type } from "@colyseus/schema";

// Define the structure for individual player data using Colyseus Schema
export class PlayerState extends Schema {
  // No @type needed for sessionId, it's the map key
  // id: string; // Not needed as field, use client.sessionId

  @type("number") x: number = 0;
  @type("number") y: number = 0;
  @type("number") angle: number = 0;
  @type("number") vx: number = 0; // Velocity x
  @type("number") vy: number = 0; // Velocity y
  @type("number") angularVelocity: number = 0;
  @type("boolean") isSleeping: boolean = false; // Indicate if the physics body is sleeping
  @type("string") cargo: string | null = null;
}

// --- NEW Nested Schemas for PlanetConfig ---
// Export these classes so they can be imported elsewhere
export class PlanetColors extends Schema {
  @type("string") base: string = "#808080"; // Default Grey
  @type("string") accent1?: string;
  @type("string") accent2?: string;
}

export class NoiseParams extends Schema {
  @type("number") scale: number = 10;
  @type("number") octaves?: number;
}
// --- END NEW ---

// Define the structure for individual planet data
export class PlanetData extends Schema {
  @type("number") x: number = 0;
  @type("number") y: number = 0;
  @type("number") radius: number = 0;
  @type("number") mass: number = 1000;
  @type("number") atmosphereHeight: number = 100;
  @type("number") surfaceDensity: number = 1.0;

  // --- Add Config Fields ---
  @type("string") seed: string = "default-seed";
  @type(PlanetColors) colors = new PlanetColors();
  @type(NoiseParams) noiseParams = new NoiseParams();
  // --- END Config Fields ---
}

// Define the overall room state using Colyseus Schema
export class RoomState extends Schema {
  // Use MapSchema to automatically synchronize a map of players
  // Key is the client's sessionId (string), Value is PlayerState
  @type({ map: PlayerState }) players = new MapSchema<PlayerState>();

  // Add a map for planets, keyed by a unique ID (e.g., "planet-1")
  @type({ map: PlanetData }) planets = new MapSchema<PlanetData>();

  // Add a field to track the physics step for reconciliation
  @type("uint32") physicsStep: number = 0;
}
