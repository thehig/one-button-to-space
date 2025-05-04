import Phaser from "phaser";
import { CommunicationManager } from "./CommunicationManager";

export default class UIManager {
  private scene: Phaser.Scene;
  private eventEmitter: Phaser.Events.EventEmitter;
  private communicationManager: CommunicationManager;
  private scoreText?: Phaser.GameObjects.Text;
  // Add other UI elements as needed (health bar, ammo count, etc.)

  constructor(
    scene: Phaser.Scene,
    eventEmitter: Phaser.Events.EventEmitter,
    communicationManager: CommunicationManager
  ) {
    this.scene = scene;
    this.eventEmitter = eventEmitter;
    this.communicationManager = communicationManager;
    this.communicationManager.logEvent("UIManager", "constructor");
  }

  init() {
    this.communicationManager.logEvent("UIManager", "initStart");
    this.setupEventListeners();
    this.communicationManager.logEvent("UIManager", "initComplete");
  }

  setupEventListeners() {
    // Listen for events that require UI updates (e.g., score changes, player health)
    this.eventEmitter.on("scoreUpdated", this.updateScoreDisplay, this);
  }

  create() {
    this.communicationManager.logEvent("UIManager", "createStart");
    // Create static UI elements
    // Note: UI elements should often be added to a separate UI Scene overlaid on top,
    // or carefully managed with camera scrolling.
    // For simplicity here, we add directly to the main scene, assuming fixed position.

    this.scoreText = this.scene.add.text(10, 10, "Score: 0", {
      fontSize: "24px",
      color: "#ffffff",
      backgroundColor: "#000000a0", // Semi-transparent background
    });
    this.scoreText.setScrollFactor(0); // Make it fixed relative to the camera
    this.communicationManager.logEvent("UIManager", "createComplete");
  }

  updateScoreDisplay(score: number) {
    this.communicationManager.logEvent("UIManager", "updatingScoreDisplay", {
      score,
    });
    if (this.scoreText) {
      this.scoreText.setText(`Score: ${score}`);
    }
  }

  update(time: number, delta: number) {
    // Update dynamic UI elements if needed (e.g., cooldown timers)
  }

  shutdown() {
    this.communicationManager.logEvent("UIManager", "shutdownStart");
    // Destroy UI elements and remove listeners
    this.scoreText?.destroy();
    this.eventEmitter.off("scoreUpdated", this.updateScoreDisplay, this);
    this.communicationManager.logEvent("UIManager", "shutdownComplete");
  }
}
