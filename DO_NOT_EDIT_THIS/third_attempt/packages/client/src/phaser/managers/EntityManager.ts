import Phaser from "phaser";
import PhysicsManager from "./PhysicsManager"; // Import PhysicsManager
import { CommunicationManager } from "./CommunicationManager"; // Import CommunicationManager

export default class EntityManager {
  private scene: Phaser.Scene;
  private eventEmitter: Phaser.Events.EventEmitter;
  private physicsManager: PhysicsManager; // Add PhysicsManager property
  private communicationManager: CommunicationManager; // Add CommunicationManager property
  private entities: Map<string, Phaser.GameObjects.GameObject>; // Example: Store entities by a unique ID

  constructor(
    scene: Phaser.Scene,
    eventEmitter: Phaser.Events.EventEmitter,
    physicsManager: PhysicsManager,
    communicationManager: CommunicationManager // Add communicationManager to constructor
  ) {
    this.scene = scene;
    this.eventEmitter = eventEmitter;
    this.physicsManager = physicsManager; // Store physicsManager
    this.communicationManager = communicationManager; // Store communicationManager
    this.entities = new Map();
    this.communicationManager.logEvent("EntityManager", "constructor");
  }

  init() {
    this.communicationManager.logEvent("EntityManager", "initStart");
    this.setupEventListeners();
    this.communicationManager.logEvent("EntityManager", "initComplete");
  }

  setupEventListeners() {
    // Listen for events from NetworkManager (or potentially game logic) to spawn/remove entities
    this.eventEmitter.on(
      "serverEntitySpawn",
      this.handleServerEntitySpawn,
      this
    );
    this.eventEmitter.on(
      "serverEntityRemove",
      this.handleServerEntityRemove,
      this
    );
  }

  create() {
    this.communicationManager.logEvent("EntityManager", "create");
    // Create initial entities if needed (e.g., player character based on network connection)
  }

  handleServerEntitySpawn(data: {
    id: string;
    type: string;
    x: number;
    y: number;
    // Add potential physics options if sent from server
    options?: any; // Use a more specific type if possible
  }) {
    this.communicationManager.logEvent("EntityManager", "spawningEntity", data);
    if (this.entities.has(data.id)) {
      this.communicationManager.logEvent(
        "EntityManager",
        "entityAlreadyExistsWarning",
        { entityId: data.id }
      );
      return;
    }

    // --- Create Visual Representation (GameObject) ---
    let gameObject: Phaser.GameObjects.GameObject | null = null;
    // Example: Create a simple visual placeholder for now
    // In a real game, this would create sprites, etc.
    // Important: Create the visual *before* the physics body if physics body creation needs it,
    // or pass necessary visual info to physics body creation.
    // Here, we create a placeholder rectangle.
    let visualWidth = 32,
      visualHeight = 32,
      color = 0xcccccc;
    if (data.type === "player") {
      color = 0xff0000;
    }
    if (data.type === "enemy") {
      color = 0x0000ff;
      visualWidth = 24;
      visualHeight = 24;
    }
    gameObject = this.scene.add.rectangle(
      data.x,
      data.y,
      visualWidth,
      visualHeight,
      color
    );
    // Alternatively: Create sprite -> this.scene.add.sprite(data.x, data.y, textureKey);

    if (!gameObject) {
      this.communicationManager.logEvent(
        "EntityManager",
        "failedToCreateVisualError",
        { type: data.type }
      );
      return;
    }
    this.communicationManager.logEvent(
      "EntityManager",
      "createdVisualGameObject",
      { entityId: data.id }
    );
    this.entities.set(data.id, gameObject); // Store the visual representation

    // --- Create Physics Body and Map it ---
    // Pass relevant data and the created gameObject to the PhysicsManager
    // The options might contain physics-specific details (mass, friction, collision filters)
    const physicsBody = this.physicsManager.createAndMapBody(
      gameObject, // Pass the visual object
      data.type, // Pass the logical type
      data.x,
      data.y,
      data.options // Pass any physics options from network data
    );

    if (physicsBody) {
      this.communicationManager.logEvent(
        "EntityManager",
        "physicsBodyCreatedAndMapped",
        { entityId: data.id, bodyId: physicsBody.id }
      );
      // Optionally emit an event if other systems need to know the physics body exists
      this.eventEmitter.emit("physicsBodyCreated", {
        entityId: data.id,
        bodyId: physicsBody.id,
      });

      // If this spawn represents the player, emit the event for the CameraManager
      // This logic might be more robust elsewhere depending on how player identity is determined
      if (data.type === "player") {
        this.eventEmitter.emit("playerEntityCreated", data.id);
      }
    } else {
      this.communicationManager.logEvent(
        "EntityManager",
        "failedToCreatePhysicsBodyError",
        { entityId: data.id }
      );
      gameObject.destroy();
      this.entities.delete(data.id);
    }
  }

  handleServerEntityRemove(data: { id: string }) {
    this.communicationManager.logEvent("EntityManager", "removingEntity", {
      entityId: data.id,
    });
    const gameObject = this.entities.get(data.id);

    if (gameObject) {
      // 1. Remove physics body and mapping
      this.physicsManager.removeBodyAndMapping(gameObject);

      // 2. Destroy the visual representation
      gameObject.destroy();

      // 3. Remove from entity map
      this.entities.delete(data.id);
      this.communicationManager.logEvent(
        "EntityManager",
        "entityFullyRemoved",
        {
          entityId: data.id,
        }
      );
    } else {
      this.communicationManager.logEvent(
        "EntityManager",
        "removeNonExistentEntityWarning",
        { entityId: data.id }
      );
    }
  }

  update(time: number, delta: number) {
    // Update entities (e.g., interpolation based on network updates)
    this.entities.forEach((entity, id) => {
      // Example: Update entity positions based on interpolated server data
    });
  }

  getEntity(id: string): Phaser.GameObjects.GameObject | undefined {
    return this.entities.get(id);
  }

  shutdown() {
    this.communicationManager.logEvent("EntityManager", "shutdownStart");
    // Destroy all managed entities and clean up listeners
    // Ensure physics bodies are removed via PhysicsManager during shutdown
    // Iterate IDs and call remove logic to ensure physics cleanup
    const entityIds = Array.from(this.entities.keys());
    entityIds.forEach((id) => this.handleServerEntityRemove({ id }));
    // This should clear the map: this.entities.clear();

    this.eventEmitter.off(
      "serverEntitySpawn",
      this.handleServerEntitySpawn,
      this
    );
    this.eventEmitter.off(
      "serverEntityRemove",
      this.handleServerEntityRemove,
      this
    );
    this.communicationManager.logEvent("EntityManager", "shutdownComplete");
  }
}
