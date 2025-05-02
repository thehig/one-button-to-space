import Phaser from "phaser";

export default class MainMenuScene extends Phaser.Scene {
  constructor() {
    super("MainMenuScene");
  }

  preload() {
    console.log("MainMenuScene: preload");
    // Load menu assets (buttons, background)
  }

  create() {
    console.log("MainMenuScene: create");
    // Create menu elements (title, buttons)

    // Example: Add some text and a button to start the game
    this.add
      .text(400, 200, "Main Menu", {
        fontSize: "48px",
        color: "#ffffff",
      })
      .setOrigin(0.5);

    const startButton = this.add
      .text(400, 400, "Start Game", {
        fontSize: "32px",
        color: "#00ff00",
        backgroundColor: "#333333",
        padding: { x: 20, y: 10 },
      })
      .setOrigin(0.5)
      .setInteractive();

    startButton.on("pointerdown", () => {
      console.log("Start button clicked");
      this.scene.start("GameScene"); // Transition to GameScene
    });

    startButton.on("pointerover", () => {
      startButton.setStyle({ fill: "#ffff00" });
    });

    startButton.on("pointerout", () => {
      startButton.setStyle({ fill: "#00ff00" });
    });
  }

  update(time: number, delta: number) {
    // Menu-specific updates, if any (e.g., animations)
  }
}
