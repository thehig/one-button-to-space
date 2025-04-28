import Phaser from "phaser";

/**
 * Placeholder scene for the main menu.
 */
export class MainMenuScene extends Phaser.Scene {
  private errorText: Phaser.GameObjects.Text | null = null;

  constructor() {
    super("MainMenuScene");
  }

  init(data: { error?: string; message?: string }): void {
    console.log("MainMenuScene: Init", data);
    // Optionally handle error/message passed from previous scene
    if (data?.error) {
      console.error("Arrived at Main Menu with error:", data.error);
    } else if (data?.message) {
      console.log("Arrived at Main Menu with message:", data.message);
    }
  }

  create(data: { error?: string; message?: string }): void {
    console.log("MainMenuScene: Create");
    const centerX = this.cameras.main.worldView.x + this.cameras.main.width / 2;
    const centerY =
      this.cameras.main.worldView.y + this.cameras.main.height / 2;

    // Simple title
    this.add
      .text(centerX, centerY - 50, "Main Menu (Placeholder)", {
        fontSize: "32px",
        color: "#fff",
      })
      .setOrigin(0.5);

    // Display error or message if provided
    const infoMessage = data?.error
      ? `Error: ${data.error}`
      : data?.message ?? "";
    if (infoMessage) {
      this.errorText = this.add
        .text(centerX, centerY + 50, infoMessage, {
          fontSize: "18px",
          color: data?.error ? "#ff0000" : "#ffff00",
          align: "center",
          wordWrap: { width: this.cameras.main.width - 40 },
        })
        .setOrigin(0.5);
    }

    // Example: Add a button or text to start the game again
    const startButton = this.add
      .text(centerX, centerY + 150, "Click to Start Game", {
        fontSize: "24px",
        color: "#0f0",
        backgroundColor: "#333",
        padding: { x: 10, y: 5 },
      })
      .setOrigin(0.5)
      .setInteractive();

    startButton.on("pointerdown", () => {
      console.log("MainMenuScene: Starting GameScene...");
      // Clear any error message before starting
      this.errorText?.destroy();
      this.scene.start("GameScene"); // Transition back to GameScene
    });
  }
}
