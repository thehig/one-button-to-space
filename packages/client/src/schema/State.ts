/**
 * ! THIS FILE IS DUPLICATED IN THE CLIENT PACKAGE
 * !      packages\client\src\schema\State.ts
 * ! WHEN EDITING, MAKE SURE TO UPDATE THE CLIENT VERSION AS WELL
 */

import { Schema, type, MapSchema, ArraySchema } from "@colyseus/schema";

// --- Basic Schemas ---

export class ColorData extends Schema {
  @type("string") base: string = "#ffffff";
  @type("string") accent1?: string;
  @type("string") accent2?: string;
}

export class NoiseParams extends Schema {
  @type("number") scale: number = 1;
  @type("number") octaves?: number;
}

// Simple XY vector for vertices
export class VectorSchema extends Schema {
  @type("number") x: number = 0;
  @type("number") y: number = 0;
}

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

// --- Player Configuration Schema ---
export class PlayerConfigSchema extends Schema {
  /**
   * A Number that defines the mass of the body.
   * The higher the mass the more force is required to change the motion of the body.
   * See also Body.density.
   * **Read only**. Use Body.setMass to set.
   *
   * https://brm.io/matter-js/docs/classes/Body.html#property_mass
   */
  @type("number") mass: number = 10;
  /**
   * A Number that defines the friction of the body.
   * The value is always positive and is in the range (0, 1).
   * A value of 0 means that the body may slide indefinitely.
   * A value of 1 means the body may come to a stop almost instantly after a force is applied.
   *
   * https://brm.io/matter-js/docs/classes/Body.html#property_friction
   */
  @type("number") friction: number = 0.05;
  /**
   * A Number that defines the air friction of the body.
   * The value is always positive and is in the range (0, 1).
   * A value of 0 means the body will never slow as it moves through space.
   * The higher the value, the faster a body slows when moving through space.
   *
   * https://brm.io/matter-js/docs/classes/Body.html#property_frictionAir
   */
  @type("number") frictionAir: number = 0.01;
  /**
   * A Number that defines the restitution (elasticity) of the body.
   * The value is always positive and is in the range (0, 1).
   * A value of 0 means collisions may be perfectly inelastic and no bouncing may occur.
   * A value of 0.8 means the body may bounce back with approximately 80% of its kinetic energy.
   * Note that collision response is based on *pairs* of bodies, and that restitution values are *combined*
   * with the following formula: Math.max(bodyA.restitution, bodyB.restitution)
   *
   * https://brm.io/matter-js/docs/classes/Body.html#property_restitution
   */
  @type("number") restitution: number = 0.3;
  /**
   * A bit field that specifies the collision category this body belongs to.
   * There are 32 available categories (0x0001 to 0x80000000).
   * This property is part of the collisionFilter object.
   *
   * https://brm.io/matter-js/docs/classes/Body.html#property_collisionFilter.category
   */
  @type("number") collisionCategory: number = 0x0001; // Default? Should be set server-side
  /**
   * A bit mask that specifies the collision categories this body may collide with.
   * This property is part of the collisionFilter object.
   *
   * https://brm.io/matter-js/docs/classes/Body.html#property_collisionFilter.mask
   */
  @type("number") collisionMask: number = 0xffff; // Default? Should be set server-side

  /**
   * A list of vertices that define the shape of the body.
   *
   * https://brm.io/matter-js/docs/classes/Body.html#property_vertices
   */
  @type([VectorSchema]) vertices = new ArraySchema<VectorSchema>();
}

// --- RoomState Definition ---
export class RoomState extends Schema {
  @type({ map: PlayerState }) players = new MapSchema<PlayerState>();
  @type({ map: PlanetData }) planets = new MapSchema<PlanetData>();
  @type("number") physicsStep = 0; // Add physics step counter
  @type("number") serverTime: number = 0;
  @type(PlayerConfigSchema) playerConfig = new PlayerConfigSchema();
}
