import Phaser from "phaser";
import { CommunicationManager } from "@one-button-to-space/logger-ui";

export default class MainMenuScene extends Phaser.Scene {
  constructor() {
    super("MainMenuScene");
  }

  preload() {
    CommunicationManager.getInstance().logEvent("MainMenuScene", "preload");
    // Load menu assets (buttons, background)
  }

  create() {
    CommunicationManager.getInstance().logEvent("MainMenuScene", "createStart");
    // Create menu elements (title, buttons)

    // Example: Add some text and a button to start the game
    this.add
      .text(400, 150, "One Button To Space", {
        font: "48px Arial",
        color: "#ffffff",
      })
      .setOrigin(0.5);

    const startButton = this.add
      .text(400, 300, "Start Game", {
        font: "32px Arial",
        color: "#00ff00",
        backgroundColor: "#333333",
        padding: { x: 20, y: 10 },
      })
      .setOrigin(0.5)
      .setInteractive();

    startButton.on("pointerdown", () => {
      CommunicationManager.getInstance().logEvent(
        "MainMenuScene",
        "startGameClicked"
      );
      this.scene.start("GameScene"); // Transition to GameScene
    });

    startButton.on("pointerover", () => {
      startButton.setStyle({ fill: "#ff0" });
    });

    startButton.on("pointerout", () => {
      startButton.setStyle({ fill: "#0f0" });
    });

    CommunicationManager.getInstance().logEvent(
      "MainMenuScene",
      "createComplete"
    );
  }

  update(time: number, delta: number) {
    // Menu-specific updates, if any (e.g., animations)
  }
}
