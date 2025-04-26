import Phaser from "phaser";
import { StarField } from "./StarField";
import { Logger } from "@one-button-to-space/shared";

// Add a source constant for logging specific to this file
const LOGGER_SOURCE = "✨🌌"; // Example emojis for StarFieldRenderer

// Import STARFIELD constants - ASSUMING THEY ARE EXPORTED or redefine here
// If not exported from StarField.ts, define them here:
const STARFIELD_FIXED_WIDTH = 5000;
const STARFIELD_FIXED_HEIGHT = 5000;

// Simplified config for static starfield
interface StarFieldRendererConfig {
  backgroundColor: string | null; // e.g., '#000011' or null for transparent
  depth: number;
  // Removed parallax and regeneration buffer configs
}

const DEFAULT_RENDER_CONFIG: StarFieldRendererConfig = {
  backgroundColor: "#000011",
  depth: -10, // Render behind most other game objects
  // Removed parallax and regeneration buffer defaults
};

export class StarFieldRenderer {
  private scene: Phaser.Scene;
  private starfield: StarField;
  private renderTexture: Phaser.GameObjects.RenderTexture | null = null;
  // Keep graphics for background fill if needed
  private backgroundGraphics: Phaser.GameObjects.Graphics | null = null;
  private config: StarFieldRendererConfig;
  private isDestroyed: boolean = false;

  // Store the bound handler for correct removal
  private boundHandleResize: () => void;

  constructor(
    scene: Phaser.Scene,
    starfield: StarField,
    config: Partial<StarFieldRendererConfig> = {}
  ) {
    this.scene = scene;
    this.starfield = starfield; // Starfield generates stars in its constructor
    this.config = { ...DEFAULT_RENDER_CONFIG, ...config };
    this.isDestroyed = false;

    // Create graphics only if background color is set
    if (this.config.backgroundColor) {
      this.backgroundGraphics = this.scene.add.graphics();
      this.backgroundGraphics.setDepth(this.config.depth - 1); // Ensure background is behind stars
    }

    // Create and draw the RenderTexture
    this.createAndDrawStarTexture();

    // Bind the resize handler - Only needed for background fill resizing
    this.boundHandleResize = this.handleResize.bind(this);
    this.scene.scale.on("resize", this.boundHandleResize);

    Logger.info(LOGGER_SOURCE, "Initialized RenderTexture StarFieldRenderer");
  }

  private createAndDrawStarTexture(): void {
    // Destroy previous texture if it exists
    if (this.renderTexture) {
      this.renderTexture.destroy();
    }

    Logger.debug(
      LOGGER_SOURCE,
      `Creating RenderTexture ${STARFIELD_FIXED_WIDTH}x${STARFIELD_FIXED_HEIGHT}`
    );
    this.renderTexture = this.scene.add.renderTexture(
      0,
      0, // Position of the texture itself in the world
      STARFIELD_FIXED_WIDTH,
      STARFIELD_FIXED_HEIGHT
    );
    // Center the texture's origin so positioning it at (0,0) centers the starfield
    this.renderTexture.setOrigin(0.5, 0.5);
    this.renderTexture.setDepth(this.config.depth); // Set depth for the texture itself

    const stars = this.starfield.getStars();
    Logger.debug(
      LOGGER_SOURCE,
      `Drawing ${stars.length} stars onto RenderTexture...`
    );

    // Temporary graphics object for drawing onto the RenderTexture
    const tempGraphics = this.scene.make.graphics({ x: 0, y: 0, add: false });

    stars.forEach((star) => {
      try {
        const starColor = Phaser.Display.Color.ValueToColor(star.color);
        tempGraphics.fillStyle(starColor.color, starColor.alphaGL);
        // Adjust draw position because RenderTexture origin is top-left (0,0)
        // We draw relative to the texture's center.
        const drawX = star.x + STARFIELD_FIXED_WIDTH / 2;
        const drawY = star.y + STARFIELD_FIXED_HEIGHT / 2;
        tempGraphics.fillCircle(drawX, drawY, star.size);
      } catch (error) {
        Logger.warn(
          LOGGER_SOURCE,
          `Failed to parse star color for texture: ${star.color}`,
          error
        );
        tempGraphics.fillStyle(0xffffff, star.brightness);
        const drawX = star.x + STARFIELD_FIXED_WIDTH / 2;
        const drawY = star.y + STARFIELD_FIXED_HEIGHT / 2;
        tempGraphics.fillCircle(drawX, drawY, star.size);
      }
    });

    // Draw the graphics onto the RenderTexture
    this.renderTexture.draw(tempGraphics);

    // Clean up temporary graphics object
    tempGraphics.destroy();

    Logger.debug(LOGGER_SOURCE, "Finished drawing stars onto RenderTexture.");
  }

  private handleResize(): void {
    if (this.isDestroyed) return;
    Logger.debug(LOGGER_SOURCE, `Handling resize event.`);

    // Only need to redraw the background fill
    this.drawBackgroundFill();
  }

  // Helper to draw background fill
  private drawBackgroundFill(): void {
    if (!this.backgroundGraphics || this.isDestroyed) return;

    this.backgroundGraphics.clear();
    if (this.config.backgroundColor) {
      const camera = this.scene.cameras.main;
      const bgColor = Phaser.Display.Color.ValueToColor(
        this.config.backgroundColor
      );
      this.backgroundGraphics.fillStyle(bgColor.color, bgColor.alphaGL);
      this.backgroundGraphics.fillRect(
        camera.worldView.x,
        camera.worldView.y,
        camera.worldView.width,
        camera.worldView.height
      );
    }
  }

  // Render method becomes much simpler
  public render(): void {
    if (this.isDestroyed) return;

    // Background fill needs to be redrawn if camera moves/zooms
    this.drawBackgroundFill();

    // The RenderTexture is a GameObject, Phaser handles rendering it based on camera
    // Ensure it's visible (it should be by default)
    if (this.renderTexture && !this.renderTexture.visible) {
      this.renderTexture.setVisible(true);
    }
  }

  public updateConfig(newConfig: Partial<StarFieldRendererConfig>): void {
    if (this.isDestroyed) return;
    const oldDepth = this.config.depth;
    const oldBgColor = this.config.backgroundColor;

    this.config = { ...this.config, ...newConfig };

    // Update depth if changed
    if (this.renderTexture && oldDepth !== this.config.depth) {
      this.renderTexture.setDepth(this.config.depth);
    }
    if (this.backgroundGraphics && oldDepth !== this.config.depth) {
      this.backgroundGraphics.setDepth(this.config.depth - 1);
    }

    // Handle background color change
    if (oldBgColor !== this.config.backgroundColor) {
      if (this.config.backgroundColor && !this.backgroundGraphics) {
        // Create graphics if switching to having a background
        this.backgroundGraphics = this.scene.add.graphics();
        this.backgroundGraphics.setDepth(this.config.depth - 1);
      } else if (!this.config.backgroundColor && this.backgroundGraphics) {
        // Destroy graphics if switching to no background
        this.backgroundGraphics.destroy();
        this.backgroundGraphics = null;
      }
    }

    Logger.info(
      LOGGER_SOURCE,
      `RenderTexture Renderer config updated: ${JSON.stringify(this.config)}`
    );
    // Trigger redraw of background immediately
    this.drawBackgroundFill();
    // Note: Changes to StarField density/seed require recreating the StarField instance
    // and then calling createAndDrawStarTexture() again on the renderer.
  }

  public destroy(): void {
    if (this.isDestroyed) return;
    this.isDestroyed = true;
    if (this.renderTexture) {
      this.renderTexture.destroy();
      this.renderTexture = null;
    }
    if (this.backgroundGraphics) {
      this.backgroundGraphics.destroy();
      this.backgroundGraphics = null;
    }
    if (this.scene && this.scene.scale && this.boundHandleResize) {
      this.scene.scale.off("resize", this.boundHandleResize);
    }
    Logger.info(LOGGER_SOURCE, "Destroyed RenderTexture StarFieldRenderer");
  }

  // Update loop is now very simple
  public update(time: number, delta: number): void {
    if (this.isDestroyed) return;

    // Redraw background fill every frame to cover camera movement/zoom
    this.drawBackgroundFill();

    // Twinkling requires re-rendering the texture or using shaders/effects
    // If StarField.update modified star brightness/color, we'd need to redraw the texture:
    // this.starfield.update(time / 1000);
    // this.redrawStarTexture(); // <--- This would be expensive! Keep twinkling off for now.

    // No explicit render call needed for the RenderTexture itself
    // this.render(); // Becomes redundant as Phaser handles RT rendering
  }

  // Optional: Add method to explicitly redraw texture if star properties change (e.g., for twinkling)
  /*
   private redrawStarTexture(): void {
       if (!this.renderTexture || this.isDestroyed) return;
       this.renderTexture.clear();
       // Reuse temporary graphics drawing logic from createAndDrawStarTexture
       // ... draw stars onto this.renderTexture ...
       Logger.debug(LOGGER_SOURCE, "Redrawing stars onto RenderTexture.");
   }
   */
}
