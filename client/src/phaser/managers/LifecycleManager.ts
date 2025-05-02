import Phaser from "phaser";
import PhysicsManager from "./PhysicsManager";
import InputManager from "./InputManager";
import NetworkManager from "./NetworkManager";
import EntityManager from "./EntityManager";
import CameraManager from "./CameraManager";
import UIManager from "./UIManager";
import AudioManager from "./AudioManager";

// This manager coordinates the lifecycle of all other managers
export default class LifecycleManager {
  private scene: Phaser.Scene;
  private eventEmitter: Phaser.Events.EventEmitter;

  // Manager instances
  private physicsManager!: PhysicsManager;
  private inputManager!: InputManager;
  private networkManager!: NetworkManager;
  private entityManager!: EntityManager;
  private cameraManager!: CameraManager;
  private uiManager!: UIManager;
  private audioManager!: AudioManager;

  constructor(scene: Phaser.Scene, eventEmitter: Phaser.Events.EventEmitter) {
    console.group("LifecycleManager: Constructor"); // Start group
    this.scene = scene;
    this.eventEmitter = eventEmitter;
    console.log("LifecycleManager: constructor called");
    this.instantiateManagers();
    console.groupEnd(); // End group
  }

  private instantiateManagers() {
    console.group("LifecycleManager: Instantiate Managers"); // Start group
    console.log("Instantiating managers...");
    // Instantiate managers, injecting scene, eventEmitter, and other managers as needed
    // Order matters based on dependencies for construction or later initialization
    this.physicsManager = new PhysicsManager(this.scene);
    this.entityManager = new EntityManager(this.scene, this.eventEmitter);
    this.inputManager = new InputManager(this.scene, this.eventEmitter);
    this.networkManager = new NetworkManager(this.scene, this.eventEmitter);
    // CameraManager depends on EntityManager instance
    this.cameraManager = new CameraManager(
      this.scene,
      this.entityManager,
      this.eventEmitter
    );
    this.uiManager = new UIManager(this.scene, this.eventEmitter);
    this.audioManager = new AudioManager(this.scene, this.eventEmitter);
    console.log("Managers instantiated.");
    console.groupEnd(); // End group
  }

  // Called from Scene.preload
  preload() {
    console.group("LifecycleManager: Preload Phase"); // Start group
    console.log("Calling manager preload methods...");
    this.audioManager.preload();
    console.log("Manager preload complete.");
    console.groupEnd(); // End group
  }

  // Called from Scene.create, after preload is complete
  create() {
    console.group("LifecycleManager: Create Phase"); // Start group

    console.group("LifecycleManager: Initializing Managers"); // Nested group
    console.log("Calling manager init methods...");
    this.physicsManager.init();
    this.entityManager.init();
    this.inputManager.init();
    this.networkManager.init();
    this.cameraManager.init();
    this.uiManager.init();
    this.audioManager.init();
    console.log("Manager init complete.");
    console.groupEnd(); // End nested group

    console.group("LifecycleManager: Creating Managers"); // Nested group
    console.log("Calling manager create methods...");
    this.physicsManager.create();
    this.entityManager.create();
    this.inputManager.create();
    this.networkManager.create();
    this.cameraManager.create();
    this.uiManager.create();
    this.audioManager.create();
    console.log("Manager create complete.");
    console.groupEnd(); // End nested group

    console.log("LifecycleManager: Managers initialized and created.");

    // Move the example event triggers here if they are for testing manager setup
    console.log("LifecycleManager: Triggering test events...");
    setTimeout(() => {
      // this.eventEmitter.emit("playAudio", "coin"); // Still commented out
      this.eventEmitter.emit("scoreUpdated", 150); // Changed score for differentiation
      // Simulate player spawn for camera
      this.eventEmitter.emit("serverEntitySpawn", {
        id: "player1",
        type: "player",
        x: 100,
        y: 100,
      });
      this.eventEmitter.emit("playerEntityCreated", "player1");
      console.log("LifecycleManager: Test events triggered.");
    }, 2000);

    console.log("LifecycleManager: Create Phase Complete.");
    console.groupEnd(); // End group
  }

  // Called from Scene.update
  update(time: number, delta: number) {
    // Only group update logs if they become noisy, otherwise it might be too much.
    // For now, let manager update logs appear directly.
    // console.groupCollapsed(`LifecycleManager: Update Phase (time: ${time.toFixed(0)})`);
    this.inputManager.update(time, delta);
    this.networkManager.update(time, delta);
    this.entityManager.update(time, delta);
    this.physicsManager.update(time, delta);
    this.cameraManager.update(time, delta);
    this.uiManager.update(time, delta);
    this.audioManager.update(time, delta);
    // console.groupEnd();
  }

  // Called from Scene.shutdown
  shutdown() {
    console.group("LifecycleManager: Shutdown Phase"); // Start group
    console.log("Calling manager shutdown methods...");
    this.audioManager.shutdown();
    this.uiManager.shutdown();
    this.cameraManager.shutdown();
    this.networkManager.shutdown();
    this.inputManager.shutdown();
    this.entityManager.shutdown();
    this.physicsManager.shutdown();

    console.log("Cleaning up event emitter...");
    this.eventEmitter.removeAllListeners();
    console.log("Managers shut down and emitter cleared.");
    console.groupEnd(); // End group
  }

  // Optional: Provide access to managers if needed by the scene directly (use sparingly)
  // public getNetworkManager(): NetworkManager { return this.networkManager; }
  // public getEntityManager(): EntityManager { return this.entityManager; }
}
