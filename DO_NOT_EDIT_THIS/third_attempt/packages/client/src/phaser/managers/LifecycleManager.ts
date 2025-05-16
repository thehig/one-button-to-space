import Phaser from "phaser";
import PhysicsManager from "./PhysicsManager";
import InputManager from "./InputManager";
import NetworkManager from "./NetworkManager";
import EntityManager from "./EntityManager";
import CameraManager from "./CameraManager";
import UIManager from "./UIManager";
import AudioManager from "./AudioManager";
import { CommunicationManager } from "@one-button-to-space/logger-ui";

// Define a type for the logger function if needed, or pass the whole manager
type LoggerFunction = (
  source: string,
  eventName: string,
  data?: unknown
) => void;

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
  private communicationManager: CommunicationManager;

  constructor(scene: Phaser.Scene, eventEmitter: Phaser.Events.EventEmitter) {
    this.scene = scene;
    this.eventEmitter = eventEmitter;
    this.communicationManager = CommunicationManager.getInstance();
    this.communicationManager.logEvent("LifecycleManager", "constructorCalled");
    this.instantiateManagers();
    this.communicationManager.logEvent(
      "LifecycleManager",
      "constructorComplete"
    );
  }

  private instantiateManagers() {
    this.communicationManager.logEvent(
      "LifecycleManager",
      "instantiatingManagersStart"
    );
    this.physicsManager = new PhysicsManager(
      this.scene,
      this.communicationManager
    );
    this.entityManager = new EntityManager(
      this.scene,
      this.eventEmitter,
      this.physicsManager,
      this.communicationManager
    );
    this.inputManager = new InputManager(
      this.scene,
      this.eventEmitter,
      this.communicationManager
    );
    this.networkManager = new NetworkManager(
      this.scene,
      this.eventEmitter,
      this.communicationManager
    );
    this.cameraManager = new CameraManager(
      this.scene,
      this.entityManager,
      this.eventEmitter,
      this.communicationManager
    );
    this.uiManager = new UIManager(
      this.scene,
      this.eventEmitter,
      this.communicationManager
    );
    this.audioManager = new AudioManager(
      this.scene,
      this.eventEmitter,
      this.communicationManager
    );

    // Initialize CommunicationManager subscriptions AFTER all managers are instantiated
    this.communicationManager.initialize({
      sceneEmitter: this.eventEmitter,
      phaserSceneEvents: this.scene.events,
      phaserGameEvents: this.scene.game.events,
      // Pass other managers/emitters if needed
    });

    this.communicationManager.logEvent(
      "LifecycleManager",
      "instantiatingManagersComplete"
    );
  }

  // Called from Scene.preload
  preload() {
    this.communicationManager.logEvent("LifecycleManager", "preloadPhaseStart");
    this.audioManager.preload();
    this.communicationManager.logEvent(
      "LifecycleManager",
      "preloadPhaseComplete"
    );
  }

  // Called from Scene.create, after preload is complete
  create() {
    this.communicationManager.logEvent("LifecycleManager", "createPhaseStart");

    this.communicationManager.logEvent("LifecycleManager", "managerInitStart");
    this.physicsManager.init();
    this.entityManager.init();
    this.inputManager.init();
    this.networkManager.init();
    this.cameraManager.init();
    this.uiManager.init();
    this.audioManager.init();
    this.communicationManager.logEvent(
      "LifecycleManager",
      "managerInitComplete"
    );

    this.communicationManager.logEvent(
      "LifecycleManager",
      "managerCreateStart"
    );
    this.physicsManager.create();
    this.entityManager.create();
    this.inputManager.create();
    this.networkManager.create();
    this.cameraManager.create();
    this.uiManager.create();
    this.audioManager.create();
    this.communicationManager.logEvent(
      "LifecycleManager",
      "managerCreateComplete"
    );

    this.communicationManager.logEvent(
      "LifecycleManager",
      "managersInitializedAndCreated"
    );

    // Move the example event triggers here if they are for testing manager setup
    this.communicationManager.logEvent(
      "LifecycleManager",
      "triggeringTestEvents"
    );
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
      this.communicationManager.logEvent(
        "LifecycleManager",
        "testEventsTriggered"
      );
    }, 2000);

    this.communicationManager.logEvent(
      "LifecycleManager",
      "createPhaseComplete"
    );
  }

  // Called from Scene.update
  update(time: number, delta: number) {
    this.inputManager.update(time, delta);
    this.networkManager.update(time, delta);
    this.entityManager.update(time, delta);
    this.physicsManager.update(time, delta);
    this.cameraManager.update(time, delta);
    this.uiManager.update(time, delta);
    this.audioManager.update(time, delta);
  }

  // Called from Scene.shutdown
  shutdown() {
    this.communicationManager.logEvent(
      "LifecycleManager",
      "shutdownPhaseStart"
    );
    this.audioManager.shutdown();
    this.uiManager.shutdown();
    this.cameraManager.shutdown();
    this.networkManager.shutdown();
    this.inputManager.shutdown();
    this.entityManager.shutdown();
    this.physicsManager.shutdown();

    // Now destroy communication manager
    this.communicationManager.destroy();

    this.communicationManager.logEvent("LifecycleManager", "cleaningUpEmitter");
    this.eventEmitter.removeAllListeners();
  }

  // Optional: Provide access to managers if needed by the scene directly (use sparingly)
  // public getNetworkManager(): NetworkManager { return this.networkManager; }
  // public getEntityManager(): EntityManager { return this.entityManager; }
  // public getCommunicationManager(): CommunicationManager { return this.communicationManager; }
}
