import Phaser from "phaser";
import { Logger } from "@one-button-to-space/shared";

// Logger Source for this file
const LOGGER_SOURCE = "🏠🖱️";

/**
 * Placeholder scene for the main menu.
 */
export class MainMenuScene extends Phaser.Scene {
  private errorText: Phaser.GameObjects.Text | null = null;

  constructor() {
    super("MainMenuScene");
  }

  init(data: { error?: string; message?: string }): void {
    Logger.info(LOGGER_SOURCE, "MainMenuScene Init", data);
    if (data?.error) {
      Logger.error(LOGGER_SOURCE, "Arrived with error:", data.error);
    } else if (data?.message) {
      Logger.info(LOGGER_SOURCE, "Arrived with message:", data.message);
    }
  }

  create(data: { error?: string; message?: string }): void {
    Logger.info(LOGGER_SOURCE, "MainMenuScene Create");
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
      Logger.info(LOGGER_SOURCE, "Starting GameScene...");
      this.errorText?.destroy();
      this.scene.start("GameScene");
    });
  }
}
