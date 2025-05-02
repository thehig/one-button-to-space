import Phaser from "phaser";
// Remove direct manager imports if no longer needed directly in the scene
// import PhysicsManager from "../managers/PhysicsManager";
// import InputManager from "../managers/InputManager";
// ... etc.
import LifecycleManager from "../managers/LifecycleManager";

export default class GameScene extends Phaser.Scene {
  private eventEmitter: Phaser.Events.EventEmitter;
  private lifecycleManager!: LifecycleManager;
  // Remove individual manager properties
  // private physicsManager!: PhysicsManager;
  // ... etc.

  constructor() {
    super("GameScene");
    // Event emitter is still created here, as it's fundamental to the scene's communication
    this.eventEmitter = new Phaser.Events.EventEmitter();
  }

  preload() {
    console.log("GameScene: preload - Delegating to LifecycleManager");
    // Instantiate LifecycleManager here or in create(). If it handles preload, instantiate before calling preload.
    // Let's instantiate here to ensure it exists before preload call.
    this.lifecycleManager = new LifecycleManager(this, this.eventEmitter);
    this.lifecycleManager.preload();
    // Remove direct manager preload calls
    // this.audioManager = new AudioManager(this, this.eventEmitter);
    // this.audioManager.preload();
  }

  create() {
    console.log("GameScene: create - Delegating to LifecycleManager");
    // LifecycleManager already instantiated in preload
    // Remove all manager instantiation, init, and create calls

    // Delegate the create call to LifecycleManager
    this.lifecycleManager.create();

    // Remove test event triggers - they are now in LifecycleManager
    // setTimeout(() => { ... }, 2000);

    console.log("GameScene: create complete after LifecycleManager");
  }

  update(time: number, delta: number) {
    // Delegate update to LifecycleManager
    this.lifecycleManager.update(time, delta);
    // Remove direct manager update calls
  }

  shutdown() {
    console.log("GameScene: shutdown - Delegating to LifecycleManager");
    // Delegate shutdown to LifecycleManager
    this.lifecycleManager.shutdown();
    // Remove direct manager shutdown calls
    // Remove event emitter cleanup if LifecycleManager handles it
    // this.eventEmitter.removeAllListeners();
    console.log("GameScene: shutdown complete after LifecycleManager");
  }
}
