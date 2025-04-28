import Phaser from "phaser";
import { BaseManager } from "./BaseManager";
import { GameObject } from "../core/GameObject";
import { Player } from "../entities/Player";
// Import from the local schema copy
import {
  RoomState as GameState, // Alias RoomState to GameState used in the code
  PlayerState,
  PlanetData, // Import PlanetData directly
} from "../schema/State";

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

  // Private constructor for singleton pattern
  private constructor() {
    super();
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
    console.log(
      `EntityManager context set for scene: ${scene.scene.key}, player: ${playerSessionId}`
    );
  }

  /**
   * Process the initial full game state from the server.
   * Creates all initial entities.
   */
  public syncInitialState(state: GameState): void {
    if (!this.scene) {
      console.error(
        "EntityManager scene context not set before syncing initial state."
      );
      return;
    }
    console.log("Syncing initial state...");
    this.clearEntities(); // Ensure clean slate

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

    console.log(
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
        console.log(`Player left update: ${id}`);
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
              console.warn(
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
        console.log(`Planet removed update: ${id}`);
        this.removeEntity(id);
      }
    });
  }

  // Explicit types for parameters
  private createOrUpdatePlayer(sessionId: string, state: PlayerState): void {
    if (!this.scene) {
      console.error("Cannot create player, scene not available.");
      return;
    }

    let player = this.entities.get(sessionId) as Player | undefined;

    if (!player) {
      // Create new player instance
      const isCurrentPlayer = sessionId === this.currentPlayerSessionId;
      player = new Player(
        this.scene.matter.world,
        state.x,
        state.y,
        "player_texture",
        undefined,
        isCurrentPlayer
      );
      // Attach the session ID to the GameObject for easy lookup
      (player as any).sessionId = sessionId;
      this.addEntity(sessionId, player);
      console.log(
        `Created player ${sessionId}${isCurrentPlayer ? " (local)" : ""}`
      );

      if (isCurrentPlayer) {
        // Camera follow for the local player
        this.scene.cameras.main.startFollow(player, true, 0.1, 0.1); // Smoothed follow
        this.scene.cameras.main.setZoom(1.5); // Example zoom
      }
    } else {
      // Update existing player (interpolation/state sync handled in updateFromServer)
      player.updateFromServer(state);
    }
  }

  // Renamed function and updated parameter type
  private createOrUpdatePlanet(planetId: string, state: PlanetData): void {
    if (!this.scene) {
      console.error("Cannot create planet, scene not available.");
      return;
    }

    let entity = this.entities.get(planetId);

    if (!entity) {
      let newEntity: GameObject | undefined;

      // Simplified: Directly handle PlanetData since that's the only type now
      // TODO: Create a specific Planet GameObject if needed
      console.log(`Creating/updating placeholder logic for Planet ${planetId}`);
      // Example placeholder creation (replace with actual Planet object)
      // newEntity = new PlaceholderPlanetObject(this.scene.matter.world, state.x, state.y, state);

      // If you created a new entity object:
      if (newEntity) {
        (newEntity as any).entityId = planetId; // Attach the planet ID
        this.addEntity(planetId, newEntity);
        console.log(`Added Planet entity ${planetId}`);
        entity = newEntity;
      } else {
        // If no placeholder/object is created yet, just log it.
        console.log(`No GameObject created for Planet ${planetId}`);
        return; // Don't proceed if no entity was actually created
      }
    } else {
      // Update existing planet entity
      if (typeof entity.updateFromServer === "function") {
        entity.updateFromServer(state);
      } else {
        console.warn(
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
      console.warn(
        `Entity with ID ${id} already exists. Overwriting or updating might be needed.`
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
      console.log(`Removed entity: ${id}`);
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

  private clearEntities(): void {
    console.log(`Clearing ${this.entities.size} entities.`);
    this.scene?.cameras.main.stopFollow(); // Stop following before destroying entities
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
    console.log("Entity Manager Initialized");
  }

  public override destroy(): void {
    console.log("Entity Manager Destroyed");
    this.clearEntities();
    this.scene = null;
    this.currentPlayerSessionId = null;
    EntityManager._instance = null;
  }
}
