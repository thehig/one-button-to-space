import Phaser from "phaser";
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
  private static _instance: EntityManager | null = null;
  private scene: Phaser.Scene | null = null;
  private entities: Map<string, GameObject> = new Map(); // Map session ID (or entity ID) to GameObject
  private currentPlayerSessionId: string | null = null; // Track the client's own player
  private currentRoomState: GameState | null = null; // Store the latest known full state

  // Private constructor for singleton pattern
  private constructor() {
    super();
  }

  // Static method to reset the singleton instance AND context
  public static resetInstance(): void {
    if (EntityManager._instance) {
      // Optional: Call internal cleanup if needed before nulling
      EntityManager._instance.clearEntities(); // Example: Clear internal maps
      EntityManager._instance.scene = null;
      EntityManager._instance.currentPlayerSessionId = null;
    }
    EntityManager._instance = null;
    Logger.debug(LOGGER_SOURCE, "EntityManager instance and context reset.");
  }

  // Singleton accessor
  public static getInstance(): EntityManager {
    if (!EntityManager._instance) {
      EntityManager._instance = new EntityManager();
    }
    return EntityManager._instance;
  }

  // Set the scene context, crucial for creating Matter bodies and adding sprites
  public setSceneContext(scene: Phaser.Scene, playerSessionId: string): void {
    this.scene = scene;
    this.currentPlayerSessionId = playerSessionId;
    Logger.info(
      LOGGER_SOURCE,
      `EntityManager context set for scene: ${scene.scene.key}, player: ${playerSessionId}`
    );
  }

  /**
   * Process the initial full game state from the server.
   * Creates all initial entities.
   */
  public syncInitialState(state: GameState): void {
    if (!this.scene) {
      Logger.error(
        LOGGER_SOURCE,
        "Scene context not set before syncing initial state."
      );
      return;
    }
    Logger.info(LOGGER_SOURCE, "Syncing initial state...");
    this.clearEntities(); // Ensure clean slate
    this.currentRoomState = state; // Store initial state

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
    if (!this.scene) {
      // console.warn("EntityManager scene context not set during state update.");
      return;
    }

    this.currentRoomState = state; // Update stored state

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
    if (entity) {
      // Check if the entity has the specific physics update method
      if (typeof entity.updatePhysicsFromServer === "function") {
        entity.updatePhysicsFromServer(physicsData);
      } else {
        // Fallback or warn if the specific method doesn't exist
        // Maybe use updateFromServer as a fallback if appropriate?
        Logger.warn(
          LOGGER_SOURCE,
          `Entity ${entityId} received physics update but lacks updatePhysicsFromServer method.`
        );
        // Optionally, try a generic update as fallback:
        // if (typeof entity.updateFromServer === 'function') {
        //   entity.updateFromServer(physicsData as any); // Cast might be needed
        // }
      }
    } else {
      // This might happen briefly if state sync is slightly delayed
      // Logger.trace(LOGGER_SOURCE, `Received physics update for unknown entity: ${entityId}`);
    }
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

    // Access the stored state instead of scene data
    if (!this.currentRoomState?.playerConfig) {
      Logger.error(
        LOGGER_SOURCE,
        "Player config not found in current room state. Cannot create player."
      );
      return;
    }
    const playerConfig = this.currentRoomState.playerConfig;

    let player = this.entities.get(sessionId) as Player | undefined;

    if (!player) {
      const isCurrentPlayer = sessionId === this.currentPlayerSessionId;

      // Create new player instance, passing options correctly
      try {
        player = new Player(
          this.scene.matter.world, // Pass the matter world
          state.x, // Initial x from state
          state.y, // Initial y from state
          sessionId, // Pass the session ID
          isCurrentPlayer, // Pass the flag
          playerConfig // Pass the configuration from the state
        );
        this.addEntity(sessionId, player);
        Logger.info(
          LOGGER_SOURCE,
          `Created player ${sessionId}${isCurrentPlayer ? " (local)" : ""}`
        );
      } catch (error: any) {
        Logger.error(
          LOGGER_SOURCE,
          `Failed to create Player ${sessionId}:`,
          error
        );
        // Optionally remove from entities if partially added?
        if (this.entities.has(sessionId)) {
          this.removeEntity(sessionId);
        }
        player = undefined; // Ensure player is undefined on error
      }
    }

    if (player) {
      // Update existing or newly created player (initial state)
      player.updateFromServer(state);
    }
  }

  // Renamed function and updated parameter type
  private createOrUpdatePlanet(planetId: string, state: PlanetData): void {
    if (!this.scene || !this.scene.matter || !this.scene.matter.world) {
      Logger.error(
        LOGGER_SOURCE,
        "Cannot create planet, scene context (or matter world) not available. State update likely arrived during HMR transition."
      );
      return;
    }

    let entity = this.entities.get(planetId) as Planet | undefined; // Cast to Planet

    if (!entity) {
      // Create the new Planet GameObject instance
      try {
        const newPlanet = new Planet(
          this.scene.matter.world,
          state // Pass the full PlanetData
        );

        // Add the new entity to the manager
        this.addEntity(planetId, newPlanet);
        Logger.info(LOGGER_SOURCE, `Created Planet entity ${planetId}`);
        entity = newPlanet; // Assign for potential later use
      } catch (e) {
        Logger.error(LOGGER_SOURCE, `Failed to create Planet ${planetId}:`, e);
      }
    } else {
      // Update existing planet entity
      // Ensure updateFromServer exists before calling
      if (typeof entity.updateFromServer === "function") {
        entity.updateFromServer(state);
      } else {
        Logger.warn(
          LOGGER_SOURCE,
          `Planet entity ${planetId} exists but has no updateFromServer method.`
        );
      }
    }
  }

  private addEntity(id: string, entity: GameObject): void {
    if (!this.entities.has(id)) {
      this.entities.set(id, entity);
      // Optionally add to scene groups (e.g., this.scene.add.group)
    } else {
      Logger.warn(
        LOGGER_SOURCE,
        `Entity with ID ${id} already exists. Update should handle this.`
      );
      // Decide how to handle this - replace or ignore?
      // For now, let updateFromState handle updates.
    }
  }

  public removeEntity(id: string): void {
    const entity = this.entities.get(id);
    if (entity) {
      // Check if the main camera is following this entity
      if (this.scene?.cameras.main && this.scene.cameras.main.deadzone) {
        // Use the internal _follow property for a more direct check
        // Note: Accessing internal properties like _follow can be brittle
        if ((this.scene.cameras.main as any)._follow === entity) {
          this.scene.cameras.main.stopFollow();
        }
      }
      entity.destroyGameObject(); // Use custom destroy method
      this.entities.delete(id);
      Logger.info(LOGGER_SOURCE, `Removed entity: ${id}`);
    } else {
      // console.warn(`Attempted to remove non-existent entity: ${id}`);
    }
  }

  public getEntity(id: string): GameObject | undefined {
    return this.entities.get(id);
  }

  public getAllEntities(): Map<string, GameObject> {
    return this.entities;
  }

  public getCurrentPlayer(): Player | undefined {
    if (!this.currentPlayerSessionId) return undefined;
    return this.entities.get(this.currentPlayerSessionId) as Player | undefined;
  }

  public clearEntities(): void {
    Logger.info(LOGGER_SOURCE, `Clearing ${this.entities.size} entities.`);
    // Check if scene and camera system are valid before trying to stop follow
    if (this.scene && this.scene.cameras && this.scene.cameras.main) {
      this.scene.cameras.main.stopFollow();
    } else {
      Logger.warn(
        LOGGER_SOURCE,
        "Scene or main camera not available during clearEntities, skipping stopFollow."
      );
    }
    this.entities.forEach((entity) => {
      entity.destroyGameObject();
    });
    this.entities.clear();
  }

  // The core update loop is driven by Phaser's scene update.
  // EntityManager primarily reacts to state changes from the NetworkManager.
  // Individual entities handle their own interpolation/prediction in their update methods.

  get world(): Phaser.Physics.Matter.World | null {
    return this.scene?.matter.world ?? null;
  }

  public override init(): void {
    Logger.info(LOGGER_SOURCE, "Entity Manager Initialized");
  }

  public override destroy(): void {
    Logger.info(LOGGER_SOURCE, "Entity Manager Destroyed");
    this.clearEntities();
    this.scene = null;
    this.currentPlayerSessionId = null;
    EntityManager._instance = null;
  }
}
