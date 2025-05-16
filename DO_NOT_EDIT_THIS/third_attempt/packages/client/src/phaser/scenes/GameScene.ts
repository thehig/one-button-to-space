import Phaser from "phaser";
// Remove direct manager imports if no longer needed directly in the scene
// import PhysicsManager from "../managers/PhysicsManager";
// import InputManager from "../managers/InputManager";
// ... etc.
import LifecycleManager from "../managers/LifecycleManager";
import { CommunicationManager } from "@one-button-to-space/logger-ui";

export default class GameScene extends Phaser.Scene {
  private lifecycleManager!: LifecycleManager;
  // Remove individual manager properties
  // private physicsManager!: PhysicsManager;
  // ... etc.

  constructor() {
    super("GameScene");
  }

  init() {
    // Scene is starting
    CommunicationManager.getInstance().logEvent("GameScene", "init");
    const eventEmitter = new Phaser.Events.EventEmitter();
    this.lifecycleManager = new LifecycleManager(this, eventEmitter);
  }

  preload() {
    CommunicationManager.getInstance().logEvent("GameScene", "preloadStart");
    this.lifecycleManager.preload();
    CommunicationManager.getInstance().logEvent("GameScene", "preloadComplete");
  }

  create() {
    CommunicationManager.getInstance().logEvent("GameScene", "createStart");
    this.lifecycleManager.create();
    CommunicationManager.getInstance().logEvent("GameScene", "createComplete");
  }

  update(time: number, delta: number) {
    // Don't log every frame, too noisy
    // CommunicationManager.getInstance().logEvent('GameScene', 'update');
    this.lifecycleManager.update(time, delta);
  }

  shutdown() {
    CommunicationManager.getInstance().logEvent("GameScene", "shutdownStart");
    if (this.lifecycleManager) {
      this.lifecycleManager.shutdown();
    }
    // Any other scene-specific cleanup
    CommunicationManager.getInstance().logEvent(
      "GameScene",
      "shutdownComplete"
    );
    super.shutdown(); // Call parent shutdown method
  }
}
