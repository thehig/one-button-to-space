// src/colyseus/schema/State.ts

// Define the structure for individual player data
export interface PlayerState {
  id: string; // Corresponds to Colyseus sessionId
  x: number;
  y: number;
  angle: number;
  vx?: number; // Added optional velocity
  vy?: number; // Added optional velocity
  angularVelocity?: number; // Added optional angular velocity
  isThrusting?: boolean; // Add state for thrust
  isSleeping?: boolean; // Add state for sleeping
  cargo: any; // Placeholder for cargo data
}

// Define the structure for individual planet data
export interface PlanetData {
  x: number;
  y: number;
  radius: number;
  mass: number;
  atmosphereHeight: number;
  surfaceDensity: number;
  seed: string;
  colors: {
    base: string;
    accent1?: string;
    accent2?: string;
  };
  noiseParams: {
    scale: number;
    octaves?: number;
  };
}

// Define the overall structure of the room state shared from the server
// Note: The client receives Colyseus MapSchema instances, which have methods
// like onAdd, onRemove, onChange. Using 'any' here allows accessing these
// methods without TypeScript errors, although defining a more specific type
// reflecting MapSchema's client-side interface would be ideal if possible.
export interface RoomState {
  players: any; // Use any to allow access to runtime MapSchema methods
  planets: any; // Use any to allow access to runtime MapSchema methods
}
