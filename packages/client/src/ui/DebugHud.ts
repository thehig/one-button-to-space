import Phaser from "phaser";
import { Rocket } from "../game/entities/Rocket"; // Adjust path as needed

// Define the structure for the data the HUD needs
interface HudData {
  posX: number;
  posY: number;
  velX: number;
  velY: number;
  speed: number;
  angleDeg: number;
  density: number;
  currentTimeString: string;
  fps: number; // Added FPS field
  ups: number; // Added UPS
}

const VECTOR_SCALE = 5; // Adjust this to scale the vector line length

export class DebugHud {
  private scene: Phaser.Scene;
  private hudText: Phaser.GameObjects.Text;
  private velocityVectorGraphics: Phaser.GameObjects.Graphics; // Add graphics object

  constructor(scene: Phaser.Scene, x: number, y: number) {
    this.scene = scene;

    this.hudText = this.scene.add
      .text(x, y, "Debug HUD:\nInitializing...", {
        fontSize: "12px",
        color: "#00ff00", // Green color for debug info
        backgroundColor: "rgba(0,0,0,0.7)",
        padding: { x: 6, y: 3 },
        align: "left", // Align text to the left
        wordWrap: { width: 250 }, // Wrap text if it gets too long
      })
      .setScrollFactor(0) // Keep it fixed on screen
      .setDepth(100); // Ensure it's on top

    // Create Graphics object for the velocity vector
    // Position it below the text - adjust offset as needed
    const graphicsY = y + this.hudText.height + 10;
    this.velocityVectorGraphics = this.scene.add.graphics({
      x: x + 150,
      y: graphicsY + 10,
    }); // Position origin point
    this.velocityVectorGraphics.setScrollFactor(0).setDepth(100);
  }

  update(data: HudData): void {
    this.hudText.setText(
      `Debug HUD:
` +
        `Pos: (${data.posX.toFixed(1)}, ${data.posY.toFixed(1)})\n` +
        `Vel: (${data.velX.toFixed(2)}, ${data.velY.toFixed(2)})\n` +
        `Speed: ${data.speed.toFixed(2)}\n` +
        `Angle: ${data.angleDeg.toFixed(1)}°\n` +
        `Density: ${data.density.toFixed(4)}\n` +
        `Time: ${data.currentTimeString}\n` +
        `FPS: ${data.fps.toFixed(1)}\n` +
        `UPS: ${data.ups.toFixed(1)}`
    );

    // Update Velocity Vector
    this.velocityVectorGraphics.clear(); // Clear previous drawing
    this.velocityVectorGraphics.lineStyle(2, 0xff0000, 1); // Red line, 2px thick

    // Calculate end point based on velocity and scale
    const endX = data.velX * VECTOR_SCALE;
    const endY = data.velY * VECTOR_SCALE;

    // Draw line from origin (0,0 of the graphics object) to the end point
    this.velocityVectorGraphics.lineBetween(0, 0, endX, endY);

    // Optional: Draw a small circle at the origin for reference
    this.velocityVectorGraphics.fillStyle(0xffffff, 1);
    this.velocityVectorGraphics.fillCircle(0, 0, 2);
  }

  destroy(): void {
    this.hudText.destroy();
    this.velocityVectorGraphics.destroy(); // Destroy graphics object
  }
}
