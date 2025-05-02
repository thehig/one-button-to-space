import Phaser from "phaser";
// import Matter from "matter-js"; // Import Matter JS
import { BaseManager } from "./BaseManager";
import { GameObject } from "../core/GameObject";
import { Player } from "../entities/Player";
import { Planet } from "../entities/Planet"; // Import the new Planet class
// Import from the local schema copy
import {
  RoomState as GameState, // Alias RoomState to GameState used in the code
  PlayerState,
  PlanetData, // Import PlanetData directly
} from "../schema/State";
// Import shared constants and types
import {
  Logger,
  PhysicsStateUpdate, // Import the new type
} from "@one-button-to-space/shared";
// import { EventEmitter } from "../../utils/EventEmitter"; // Correct path if it's local
import { gameEmitter } from "../main"; // Correct path to main.tsx from managers dir
import { EngineManager } from "./EngineManager"; // Added EngineManager import

// Logger Source for this file
const LOGGER_SOURCE = "👥🧩";

// Define types for MapSchema iteration
type PlayerMapSchema = Map<string, PlayerState>;
type PlanetMapSchema = Map<string, PlanetData>; // Changed from EntityMapSchema

/**
 * Manages game entities (players, NPCs, items, etc.)
 * Handles creation, removal, updates, and synchronization with the server state.
 */
// @ts-ignore - This might resolve the static side inheritance issue if explicit typing doesn't
export class EntityManager extends BaseManager {
  // Removed Singleton pattern
  // private static _instance: EntityManager | null = null;
  private scene: Phaser.Scene | null = null;
  private entities: Map<string, GameObject> = new Map(); // Map session ID (or entity ID) to GameObject
  private currentPlayerSessionId: string | null = null; // Track the client's own player
  private currentRoomState: GameState | null = null; // Store the latest known full state
  private engineManager: EngineManager; // Added EngineManager instance variable

  // Modified constructor to accept EngineManager
  constructor(engineManager: EngineManager) {
    super();
    this.engineManager = engineManager;
  }

  // Removed Singleton resetInstance
  // public static resetInstance(): void { ... }

  // Removed Singleton getInstance
  // public static getInstance(): EntityManager { ... }

  // --- Lifecycle Methods ---

  public async setup(): Promise<void> {
    // Setup might involve waiting for GameManager to provide scene context
    Logger.info(LOGGER_SOURCE, "EntityManager setup initialized.");
    // We might need to wait for the scene to be ready here, potentially via an event
    // or by ensuring GameManager.setup() completes first in EngineManager.
    // For now, setup is minimal, actual initialization happens with setSceneContext.
  }

  public teardown(): void {
    Logger.info(LOGGER_SOURCE, "Tearing down EntityManager...");
    this.clearEntities();
    this.scene = null;
    this.currentPlayerSessionId = null;
    this.currentRoomState = null;
    Logger.info(LOGGER_SOURCE, "EntityManager teardown complete.");
  }

  // Set the scene context, crucial for creating Matter bodies and adding sprites
  // This will likely be called by GameManager after Phaser is initialized
  public setSceneContext(scene: Phaser.Scene, playerSessionId: string): void {
    this.scene = scene;
    this.currentPlayerSessionId = playerSessionId;
    Logger.info(
      LOGGER_SOURCE,
      `EntityManager context set for scene: ${scene.scene.key}, player: ${playerSessionId}`
    );
    // Potentially sync state immediately if state arrived before scene was ready
    if (this.currentRoomState) {
      Logger.info(
        LOGGER_SOURCE,
        "Scene context set, re-syncing with stored initial state."
      );
      this.syncInitialState(this.currentRoomState);
    }
  }

  /**
   * Process the initial full game state from the server.
   * Creates all initial entities.
   */
  public syncInitialState(state: GameState): void {
    this.currentRoomState = state; // Store/update state regardless of scene readiness

    if (!this.scene) {
      Logger.warn(
        LOGGER_SOURCE,
        "Scene context not yet set. Storing initial state for later synchronization."
      );
      return; // Wait for setSceneContext to be called
    }
    Logger.info(LOGGER_SOURCE, "Syncing initial state...");
    this.clearEntities(); // Ensure clean slate only when scene is ready

    // Check if players exist before iterating
    if (state.players) {
      // Explicitly cast to the defined type for iteration
      (state.players as PlayerMapSchema).forEach((playerState, sessionId) => {
        this.createOrUpdatePlayer(sessionId, playerState);
      });
    }

    // Check if planets exist before iterating (Changed from state.entities)
    if (state.planets) {
      // Explicitly cast to the defined type for iteration
      (state.planets as PlanetMapSchema).forEach((planetState, planetId) => {
        // Call the renamed function
        this.createOrUpdatePlanet(planetId, planetState);
      });
    }

    Logger.info(
      LOGGER_SOURCE,
      `Initial state synced. ${this.entities.size} entities created.`
    );
  }

  /**
   * Process incremental state updates from the server.
   * Handles entity creation, updates, and removal based on schema changes.
   */
  public updateFromState(state: GameState): void {
    this.currentRoomState = state; // Update stored state

    if (!this.scene) {
      // Logger.warn("EntityManager scene context not set during state update.");
      return; // Don't process updates if scene isn't ready
    }

    // Use Colyseus schema callbacks attached in NetworkManager for efficiency
    // This method can act as a fallback or be used if manual iteration is preferred.

    // --- Player Updates ---
    const presentPlayerIds = new Set<string>();
    if (state.players) {
      (state.players as PlayerMapSchema).forEach((playerState, sessionId) => {
        presentPlayerIds.add(sessionId);
        if (!this.entities.has(sessionId)) {
          // console.log(`Player joined update: ${sessionId}`);
          this.createOrUpdatePlayer(sessionId, playerState);
        } else {
          const playerEntity = this.entities.get(sessionId);
          if (playerEntity) {
            playerEntity.updateFromServer(playerState);
          }
        }
      });
    }
    // Check for removed players
    this.entities.forEach((entity, id) => {
      if (entity instanceof Player && !presentPlayerIds.has(id)) {
        Logger.info(LOGGER_SOURCE, `Player left update: ${id}`);
        this.removeEntity(id);
      }
    });

    // --- Generic Entity Updates (Now Planet Updates) ---
    const presentPlanetIds = new Set<string>(); // Renamed from presentEntityIds
    if (state.planets) {
      (state.planets as PlanetMapSchema).forEach((planetState, planetId) => {
        presentPlanetIds.add(planetId);
        if (!this.entities.has(planetId)) {
          // console.log(`Planet created update: ${planetId}`);
          this.createOrUpdatePlanet(planetId, planetState); // Call renamed function
        } else {
          const entity = this.entities.get(planetId);
          if (entity) {
            // Ensure updateFromServer exists and call it
            if (typeof entity.updateFromServer === "function") {
              entity.updateFromServer(planetState);
            } else {
              Logger.warn(
                LOGGER_SOURCE,
                `Planet entity ${planetId} exists but has no updateFromServer method.`
              );
            }
          }
        }
      });
    }
    // Check for removed planets (Changed from generic entities)
    this.entities.forEach((entity, id) => {
      // Check if it's NOT a player AND not in the present list
      if (!(entity instanceof Player) && !presentPlanetIds.has(id)) {
        Logger.info(LOGGER_SOURCE, `Planet removed update: ${id}`);
        this.removeEntity(id);
      }
    });
  }

  /**
   * Updates the physics state of a specific entity based on data from the server.
   * @param entityId The ID of the entity to update (e.g., session ID for players).
   * @param physicsData The physics state data received from the server.
   */
  public updateEntityPhysics(
    entityId: string,
    physicsData: PhysicsStateUpdate
  ): void {
    const entity = this.entities.get(entityId);
    if (!entity) {
      // This might happen briefly if state sync is slightly delayed
      // Logger.trace(LOGGER_SOURCE, `Received physics update for unknown entity: ${entityId}`);
      return;
    }

    // Check if the entity has the specific physics update method
    if (typeof entity.updatePhysicsFromServer === "function") {
      entity.updatePhysicsFromServer(physicsData);
    } else {
      // Fallback or warn if the specific method doesn't exist
      Logger.warn(
        LOGGER_SOURCE,
        `Entity ${entityId} received physics update but lacks updatePhysicsFromServer method.`
      );
    }

    // --- REVERTED: Remove velocity setting logic ---
    // const body = (entity as any).body as Matter.Body | undefined;
    // if (body) { ... Matter.Body.setVelocity ... }
  }

  // Explicit types for parameters
  private createOrUpdatePlayer(sessionId: string, state: PlayerState): void {
    if (!this.scene || !this.scene.matter || !this.scene.matter.world) {
      Logger.error(
        LOGGER_SOURCE,
        "Cannot create player, scene context (or matter world) not available. State update likely arrived during HMR transition."
      );
      return;
    }

    if (!(this.scene as any).isSceneReady) {
      Logger.warn(
        LOGGER_SOURCE,
        `Cannot create player ${sessionId}, scene is not ready yet.`
      );
      return;
    }

    // Access the stored state instead of scene data
    if (!this.currentRoomState?.playerConfig) {
      Logger.error(
        LOGGER_SOURCE,
        "Player config not found in current room state. Cannot create player."
      );
      return;
    }
    const playerConfig = this.currentRoomState.playerConfig;

    Logger.trace(LOGGER_SOURCE, "Creating Player", playerConfig);

    let player = this.entities.get(sessionId) as Player | undefined;

    if (!player) {
      const isCurrentPlayer = sessionId === this.currentPlayerSessionId;

      // --- Create a plain copy of the config --- //
      const configCopy = {
        mass: playerConfig.mass,
        friction: playerConfig.friction,
        frictionAir: playerConfig.frictionAir,
        restitution: playerConfig.restitution,
        collisionCategory: playerConfig.collisionCategory,
        collisionMask: playerConfig.collisionMask,
        // Explicitly map vertices to plain objects
        vertices: Array.from(playerConfig.vertices).map((v) => ({
          x: v.x,
          y: v.y,
        })),
      };
      // ----------------------------------------- //

      // Create new player instance, passing options correctly
      try {
        player = new Player(
          this.scene.matter.world, // Pass the matter world
          state.x, // Initial x from state
          state.y, // Initial y from state
          sessionId,
          isCurrentPlayer, // Pass isCurrentPlayer flag
          configCopy // ---> Pass the plain copy
        );
        this.addEntity(sessionId, player);
        // Emit only when a *new* player is created
        gameEmitter.emit("playerCreated", player); // Emit event
        if (isCurrentPlayer) {
          gameEmitter.emit("currentPlayerCreated", player);
        }
        Logger.info(LOGGER_SOURCE, `Player ${sessionId} created.`);
      } catch (error) {
        Logger.error(
          LOGGER_SOURCE,
          `Failed to create player ${sessionId}:`,
          error,
          state
        );
        return; // Don't proceed if creation fails
      }
    } else {
      // Logger.trace(`Player ${sessionId} already exists, updating.`);
      // Player update logic is handled in updateFromState/schema callbacks
      // Potentially call player.updateFromServer(state) if needed here
    }
  }

  // Explicit types for parameters
  private createOrUpdatePlanet(planetId: string, state: PlanetData): void {
    if (!this.scene || !this.scene.matter || !this.scene.matter.world) {
      Logger.error(
        LOGGER_SOURCE,
        "Cannot create planet, scene context (or matter world) not available. State update likely arrived during HMR transition."
      );
      return;
    }

    if (!(this.scene as any).isSceneReady) {
      Logger.warn(
        LOGGER_SOURCE,
        `Cannot create planet ${planetId}, scene is not ready yet.`
      );
      return;
    }

    let planet = this.entities.get(planetId) as Planet | undefined;

    if (!planet) {
      // --- ADDED: Texture existence check ---
      // Use global texture manager via game system
      if (!this.scene.sys.game.textures.exists(state.texture)) {
        Logger.error(
          LOGGER_SOURCE,
          `Cannot create planet ${planetId}, texture '${state.texture}' not found in scene texture manager.`
        );
        return;
      }
      // --- END: Texture existence check ---

      try {
        planet = new Planet(
          this.scene.matter.world,
          state.x,
          state.y,
          planetId,
          {
            radius: state.radius,
            texture: state.texture,
            gravity: state.gravity, // Make sure gravity is passed
          },
          this.scene.sys.game.textures
        );
        this.addEntity(planetId, planet);
        Logger.info(LOGGER_SOURCE, `Planet ${planetId} created.`);
      } catch (error) {
        Logger.error(
          LOGGER_SOURCE,
          `Failed to create planet ${planetId}:`,
          error,
          state
        );
        return;
      }
    } else {
      // Update existing planet if necessary (e.g., if properties change)
      // Note: updateFromServer should handle this based on state sync
      // Logger.trace(LOGGER_SOURCE, `Planet ${planetId} already exists, updating.`);
    }
  }

  // Add entity to map and potentially the scene
  private addEntity(id: string, entity: GameObject): void {
    if (!this.scene) {
      Logger.error(LOGGER_SOURCE, "Cannot add entity, scene context not set.");
      return;
    }
    if (this.entities.has(id)) {
      Logger.warn(LOGGER_SOURCE, `Entity ${id} already exists. Overwriting.`);
      this.removeEntity(id); // Clean up the old one first
    }
    this.entities.set(id, entity);
    // Assuming GameObjects add themselves to the scene if needed
    // Logger.debug(LOGGER_SOURCE, `Entity added: ${id}`);
  }

  // Remove entity from map and scene
  public removeEntity(id: string): void {
    const entity = this.entities.get(id);
    if (entity) {
      entity.destroy(); // Call GameObject's destroy method for cleanup
      this.entities.delete(id);
      Logger.info(LOGGER_SOURCE, `Entity removed: ${id}`);
    } else {
      Logger.warn(
        LOGGER_SOURCE,
        `Attempted to remove non-existent entity: ${id}`
      );
    }
  }

  // Get a specific entity by ID
  public getEntity(id: string): GameObject | undefined {
    return this.entities.get(id);
  }

  // Get all entities
  public getAllEntities(): Map<string, GameObject> {
    return this.entities;
  }

  // Get the current player entity
  public getCurrentPlayer(): Player | undefined {
    if (!this.currentPlayerSessionId) return undefined;
    return this.entities.get(this.currentPlayerSessionId) as Player | undefined;
  }

  // Clear all entities - useful for scene changes or full resets
  public clearEntities(): void {
    if (this.entities.size > 0) {
      Logger.info(LOGGER_SOURCE, `Clearing ${this.entities.size} entities...`);
      this.entities.forEach((entity) => {
        // Ensure destroy exists before calling
        if (typeof entity.destroy === "function") {
          entity.destroy();
        } else {
          Logger.warn(
            LOGGER_SOURCE,
            `Entity missing destroy method during clear: ${entity.id}`
          );
        }
      });
      this.entities.clear();
      Logger.info(LOGGER_SOURCE, "All entities cleared.");
    } else {
      Logger.trace(LOGGER_SOURCE, "No entities to clear.");
    }
  }

  // Getter for the Matter world (read-only access)
  get world(): Phaser.Physics.Matter.World | null {
    return this.scene?.matter.world ?? null;
  }

  // Removed BaseManager overrides for init/destroy as they are now setup/teardown
  // public override init(): void { ... }
  // public override destroy(): void { ... }
}
