import Phaser from "phaser";

export default class UIManager {
  private scene: Phaser.Scene;
  private eventEmitter: Phaser.Events.EventEmitter;
  private scoreText?: Phaser.GameObjects.Text;
  // Add other UI elements as needed (health bar, ammo count, etc.)

  constructor(scene: Phaser.Scene, eventEmitter: Phaser.Events.EventEmitter) {
    this.scene = scene;
    this.eventEmitter = eventEmitter;
    console.log("UIManager: constructor");
  }

  init() {
    console.log("UIManager: init");
    this.setupEventListeners();
  }

  setupEventListeners() {
    // Listen for events that require UI updates (e.g., score changes, player health)
    this.eventEmitter.on("scoreUpdated", this.updateScoreDisplay, this);
  }

  create() {
    console.log("UIManager: create");
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
  }

  updateScoreDisplay(score: number) {
    console.log("UIManager: Updating score display", score);
    if (this.scoreText) {
      this.scoreText.setText(`Score: ${score}`);
    }
  }

  update(time: number, delta: number) {
    // Update dynamic UI elements if needed (e.g., cooldown timers)
  }

  shutdown() {
    console.log("UIManager: shutdown");
    // Destroy UI elements and remove listeners
    this.scoreText?.destroy();
    this.eventEmitter.off("scoreUpdated", this.updateScoreDisplay, this);
  }
}
