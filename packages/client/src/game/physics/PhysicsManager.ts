import Phaser from "phaser";
import { Rocket } from "../entities/Rocket";
// Use direct import for Body
import { Body as MatterBody } from "matter-js";
// Keep Vector import if needed
import { Vector as MatterVector } from "matter-js";
// Remove global namespace import
// import "matter-js";
import { PlanetData } from "../../schema/State";
import { Planet } from "../entities/Planet";
import { Logger } from "@one-button-to-space/shared";
import { PhysicsLogic } from "@one-button-to-space/shared";

const LOGGER_SOURCE = "⚛️⚙️";

// Define local BodyType alias using the direct import
type BodyType = MatterBody;

// Update GravitySource interface
interface GravitySource {
  body: BodyType; // Uses alias to direct import
  mass: number;
  position: Phaser.Math.Vector2; // Keep Phaser Vector2 for convenience? Or use MatterVector/simple obj? Let's keep for now.
}

/**
 * Manages custom physics interactions, specifically variable gravity.
 * Replaces Phaser's default world gravity. Uses shared PhysicsLogic.
 */
export class PhysicsManager {
  private scene: Phaser.Scene;
  // Use direct MatterBody type for engine reference if possible,
  // otherwise keep specific MatterJS.Engine or fallback to any if needed
  // For now, assuming scene.matter.world.engine is compatible with MatterBody context
  private matterEngine: any; // Revisit this type if needed
  private rocket: Rocket | null = null;
  private gravitySources: GravitySource[] = [];
  // UPDATE map type to store Planet instances
  private syncedPlanetObjects: Map<string, Planet> = new Map();
  // REMOVE local constants, use imported ones if needed (they are in PhysicsLogic now)
  // private readonly G = 0.005;
  // private readonly DRAG_COEFFICIENT = 0.01;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    if (!scene.matter.world || !scene.matter.world.engine) {
      throw new Error("Matter world or engine not initialized in the scene!");
    }
    this.matterEngine = scene.matter.world.engine;
    Logger.info(LOGGER_SOURCE, "Initialized with Matter engine.");

    this.scene.matter.world.setGravity(0, 0);
    Logger.info(LOGGER_SOURCE, "Default Matter world gravity disabled.");
    this.scene.matter.world.on("beforeupdate", this.update, this);
    Logger.info(LOGGER_SOURCE, "Update loop registered with beforeupdate.");
  }

  // Method to register the player's rocket
  registerRocket(rocket: Rocket): void {
    this.rocket = rocket;
    Logger.info(LOGGER_SOURCE, "Rocket registered.");
  }

  // REMOVE registerPlanets method
  // registerPlanets(planets: Planet[]): void {
  //   this.planets = planets;
  //   logger.debug("PhysicsManager", `Registered ${planets.length} planets.`); // Example
  // }

  // ADD method to receive the map of synced planet objects from MainScene
  // UPDATE map type signature to accept Map<string, Planet>
  setPlanetObjectsMap(map: Map<string, Planet>): void {
    this.syncedPlanetObjects = map;
    Logger.info(
      LOGGER_SOURCE,
      `Received synced planet objects map with ${map.size} planets.`
    );
  }

  // Method to register a gravity source (like a planet)
  // MODIFY signature to accept PlanetData instead of just mass
  // Removed optional atmosphere parameters
  addGravitySource(body: BodyType, planetData: PlanetData): void {
    if (
      !body ||
      typeof body.position === "undefined" ||
      !planetData ||
      typeof planetData.mass !== "number"
    ) {
      Logger.error(
        LOGGER_SOURCE,
        "Invalid gravity source arguments:",
        body,
        planetData
      );
      return;
    }
    const gravitySource: GravitySource = {
      body: body,
      mass: planetData.mass,
      position: new Phaser.Math.Vector2(body.position.x, body.position.y),
    };
    this.gravitySources.push(gravitySource);
    Logger.info(LOGGER_SOURCE, `Gravity source added: ID=${body.id}`);
  }

  // The main update loop, called before Matter steps the simulation
  private update(event: { timestamp: number; delta: number }): void {
    // Only apply shared physics logic if the local rocket exists
    if (!this.rocket?.body) {
      return;
    }
    const rocketMatterBody = this.rocket.body;

    // --- Use Shared Gravity Logic ---
    // Map local GravitySource[] to SimpleGravitySource[] for the shared function
    const simpleGravitySources = this.gravitySources.map((source) => ({
      position: { x: source.body.position.x, y: source.body.position.y }, // Get current position
      mass: source.mass,
    }));
    PhysicsLogic.calculateAndApplyGravity(
      rocketMatterBody,
      simpleGravitySources
    );

    // --- Use Shared Air Resistance Logic ---
    // Call the correct function and map Planet instances to the expected structure
    const density = PhysicsLogic.calculateDensityAt(
      rocketMatterBody.position,
      Array.from(this.syncedPlanetObjects.values()).map((p) => ({
        x: p.body.position.x,
        y: p.body.position.y,
        radius: p.radius,
        atmosphereHeight: p.atmosphereHeight,
        surfaceDensity: p.surfaceDensity,
      }))
    );
    PhysicsLogic.calculateAndApplyAirResistance(rocketMatterBody, density);

    // logger.debug("PhysicsManager", "Update loop executed."); // Optional debug log
  }

  // Method to remove a gravity source if needed
  // Use consistent BodyType for the body parameter
  removeGravitySource(bodyToRemove: BodyType): void {
    const initialLength = this.gravitySources.length;
    this.gravitySources = this.gravitySources.filter(
      (source) => source.body.id !== bodyToRemove.id
    );
    if (this.gravitySources.length < initialLength) {
      Logger.info(
        LOGGER_SOURCE,
        `Removed gravity source with ID: ${bodyToRemove.id}`
      );
    } else {
      Logger.warn(
        LOGGER_SOURCE,
        `Gravity source ID ${bodyToRemove.id} not found.`
      );
    }
  }

  // Cleanup method when the scene shuts down
  destroy(): void {
    this.scene.matter.world.off("beforeupdate", this.update, this);
    this.rocket = null;
    this.gravitySources = [];
    Logger.info(LOGGER_SOURCE, "Destroyed and listeners removed.");
  }
}
