import Phaser from "phaser";
import EntityManager from "./EntityManager"; // May depend on EntityManager to find target

export default class CameraManager {
  private scene: Phaser.Scene;
  private entityManager: EntityManager;
  private eventEmitter: Phaser.Events.EventEmitter;
  private followTarget: Phaser.GameObjects.GameObject | null = null;

  constructor(
    scene: Phaser.Scene,
    entityManager: EntityManager,
    eventEmitter: Phaser.Events.EventEmitter
  ) {
    this.scene = scene;
    this.entityManager = entityManager;
    this.eventEmitter = eventEmitter;
    console.log("CameraManager: constructor");
  }

  init() {
    console.log("CameraManager: init");
    this.setupEventListeners();
  }

  setupEventListeners() {
    // Listen for an event that designates the player entity (or other target)
    // This might come from EntityManager or NetworkManager upon player spawn
    this.eventEmitter.on("playerEntityCreated", this.setFollowTarget, this);
  }

  create() {
    console.log("CameraManager: create");
    // Configure main camera properties
    this.scene.cameras.main.setBackgroundColor(0x1a1a1a); // Example background
    // Set bounds if the world is larger than the screen
    // this.scene.cameras.main.setBounds(0, 0, worldWidth, worldHeight);
  }

  setFollowTarget(targetId: string) {
    const target = this.entityManager.getEntity(targetId);
    if (target) {
      this.followTarget = target;
      this.scene.cameras.main.startFollow(this.followTarget, true, 0.08, 0.08); // Round pixels, lerp x/y
      console.log(`CameraManager: Now following target ${targetId}`);
    } else {
      console.warn(
        `CameraManager: Could not find target entity with ID ${targetId}`
      );
    }
  }

  update(time: number, delta: number) {
    // Camera updates (e.g., shake, custom movements) if needed
    // Following is handled automatically by Phaser once set
  }

  shutdown() {
    console.log("CameraManager: shutdown");
    // Stop following and remove listeners
    this.scene.cameras.main.stopFollow();
    this.eventEmitter.off("playerEntityCreated", this.setFollowTarget, this);
    this.followTarget = null;
  }
}
