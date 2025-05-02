import Phaser from "phaser";

export default class EntityManager {
  private scene: Phaser.Scene;
  private eventEmitter: Phaser.Events.EventEmitter;
  private entities: Map<string, Phaser.GameObjects.GameObject>; // Example: Store entities by a unique ID

  constructor(scene: Phaser.Scene, eventEmitter: Phaser.Events.EventEmitter) {
    this.scene = scene;
    this.eventEmitter = eventEmitter;
    this.entities = new Map();
    console.log("EntityManager: constructor");
  }

  init() {
    console.log("EntityManager: init");
    this.setupEventListeners();
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
    console.log("EntityManager: create");
    // Create initial entities if needed (e.g., player character based on network connection)
  }

  handleServerEntitySpawn(data: {
    id: string;
    type: string;
    x: number;
    y: number /* other props */;
  }) {
    console.log("EntityManager: Spawning entity", data);
    if (this.entities.has(data.id)) {
      console.warn(`EntityManager: Entity with id ${data.id} already exists.`);
      return;
    }

    let newEntity: Phaser.GameObjects.GameObject | null = null;

    // Example: Spawn different types of entities based on data.type
    switch (data.type) {
      case "player":
        // Replace with actual player sprite creation
        newEntity = this.scene.add.rectangle(data.x, data.y, 32, 32, 0xff0000);
        break;
      case "enemy":
        // Replace with actual enemy sprite creation
        newEntity = this.scene.add.rectangle(data.x, data.y, 24, 24, 0x0000ff);
        break;
      // Add other entity types as needed
      default:
        console.warn(`EntityManager: Unknown entity type: ${data.type}`);
        break;
    }

    if (newEntity) {
      // Set properties, add physics, etc.
      // Example: Add to physics if applicable
      // if (this.scene.physics && newEntity instanceof Phaser.Physics.Arcade.Sprite) {
      //   this.scene.physics.add.existing(newEntity);
      //   // Configure physics body
      // }
      this.entities.set(data.id, newEntity);
      console.log(`EntityManager: Entity ${data.id} (${data.type}) created.`);
    }
  }

  handleServerEntityRemove(data: { id: string }) {
    console.log("EntityManager: Removing entity", data.id);
    const entity = this.entities.get(data.id);
    if (entity) {
      entity.destroy(); // Remove from scene
      this.entities.delete(data.id);
      console.log(`EntityManager: Entity ${data.id} removed.`);
    } else {
      console.warn(
        `EntityManager: Cannot remove non-existent entity ${data.id}`
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
    console.log("EntityManager: shutdown");
    // Destroy all managed entities and clean up listeners
    this.entities.forEach((entity) => entity.destroy());
    this.entities.clear();
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
  }
}
