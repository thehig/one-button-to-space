/**
 * ! THIS FILE IS DUPLICATED IN THE CLIENT PACKAGE
 * !      packages\client\src\schema\State.ts
 * ! WHEN EDITING, MAKE SURE TO UPDATE THE CLIENT VERSION AS WELL
 */

import { Schema, type, MapSchema } from "@colyseus/schema";

// --- PlayerState Definition ---
export class PlayerState extends Schema {
  @type("string") id = ""; // Corresponds to Colyseus sessionId
  @type("number") x = 0;
  @type("number") y = 0;
  @type("number") angle = 0;
  @type("number") vx = 0; // Added optional velocity
  @type("number") vy = 0; // Added optional velocity
  @type("number") angularVelocity = 0; // Added optional angular velocity
  @type("boolean") isSleeping = false; // Add sleeping state
  @type("boolean") isThrusting = false; // Add thrusting state
  @type("string") cargo: string = ""; // Use string type for now
}

// --- PlanetData Definition ---
export class PlanetNoiseParams extends Schema {
  @type("number") scale = 1;
  @type("number") octaves = 1;
}

export class PlanetColors extends Schema {
  @type("string") base = "#ffffff";
  @type("string") accent1 = "#ffffff";
  @type("string") accent2 = "#ffffff";
}

export class PlanetData extends Schema {
  @type("string") id = ""; // Unique ID for the planet
  @type("number") x = 0;
  @type("number") y = 0;
  @type("number") radius = 100;
  @type("number") mass = 1000;
  @type("number") atmosphereHeight = 50;
  @type("number") surfaceDensity = 1;
  @type("string") seed = "default";
  @type(PlanetColors) colors = new PlanetColors();
  @type(PlanetNoiseParams) noiseParams = new PlanetNoiseParams();
}

// --- RoomState Definition ---
export class RoomState extends Schema {
  @type({ map: PlayerState }) players = new MapSchema<PlayerState>();
  @type({ map: PlanetData }) planets = new MapSchema<PlanetData>();
  @type("number") physicsStep = 0; // Add physics step counter
}
