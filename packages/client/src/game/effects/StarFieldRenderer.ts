import Phaser from "phaser";
import { StarField } from "./StarField";
import { Logger } from "@one-button-to-space/shared";

// Add a source constant for logging specific to this file
const LOGGER_SOURCE = "✨🌌"; // Example emojis for StarFieldRenderer

// Import STARFIELD constants - ASSUMING THEY ARE EXPORTED or redefine here
// If not exported from StarField.ts, define them here:
const STARFIELD_FIXED_WIDTH = 5000;
const STARFIELD_FIXED_HEIGHT = 5000;

// Define constants locally or import if exported from StarField
const STARFIELD_TEXTURE_WIDTH = 5000;
const STARFIELD_TEXTURE_HEIGHT = 5000;
const STARFIELD_TEXTURE_KEY = "starfieldTexture";

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
  private tileSprite: Phaser.GameObjects.TileSprite | null = null;
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

    // Create the texture and then the TileSprite
    this.createTextureAndTileSprite();

    // Bind the resize handler - Only needed for background fill resizing
    this.boundHandleResize = this.handleResize.bind(this);
    this.scene.scale.on("resize", this.boundHandleResize);

    Logger.info(LOGGER_SOURCE, "Initialized TileSprite StarFieldRenderer");
  }

  private createTextureAndTileSprite(): void {
    // 1. Create a temporary RenderTexture
    Logger.info(
      LOGGER_SOURCE,
      `Creating temporary RenderTexture ${STARFIELD_TEXTURE_WIDTH}x${STARFIELD_TEXTURE_HEIGHT}`
    );
    const tempRenderTexture = this.scene.make.renderTexture(
      {
        width: STARFIELD_TEXTURE_WIDTH,
        height: STARFIELD_TEXTURE_HEIGHT,
        add: false, // Don't add the RT itself to the scene
      },
      false
    );

    // 2. Draw stars onto the temporary RenderTexture
    const stars = this.starfield.getStars();
    Logger.info(
      LOGGER_SOURCE,
      `Drawing ${stars.length} stars onto temp RenderTexture...`
    );
    const tempGraphics = this.scene.make.graphics({ x: 0, y: 0, add: false });
    stars.forEach((star) => {
      try {
        const starColor = Phaser.Display.Color.ValueToColor(star.color);
        tempGraphics.fillStyle(starColor.color, starColor.alphaGL);
        const drawX = star.x + STARFIELD_TEXTURE_WIDTH / 2;
        const drawY = star.y + STARFIELD_TEXTURE_HEIGHT / 2;
        tempGraphics.fillCircle(drawX, drawY, star.size);
      } catch (error) {
        Logger.warn(
          LOGGER_SOURCE,
          `Failed to parse star color for texture: ${star.color}`,
          error
        );
        tempGraphics.fillStyle(0xffffff, star.brightness);
        const drawX = star.x + STARFIELD_TEXTURE_WIDTH / 2;
        const drawY = star.y + STARFIELD_TEXTURE_HEIGHT / 2;
        tempGraphics.fillCircle(drawX, drawY, star.size);
      }
    });
    tempRenderTexture.draw(tempGraphics);
    tempGraphics.destroy(); // Clean up graphics
    Logger.info(
      LOGGER_SOURCE,
      "Finished drawing stars onto temp RenderTexture."
    );

    // 3. Create an off-screen canvas and draw the RenderTexture onto it
    const canvas = document.createElement("canvas"); // Use standard DOM method
    canvas.width = STARFIELD_TEXTURE_WIDTH;
    canvas.height = STARFIELD_TEXTURE_HEIGHT;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      Logger.error(
        LOGGER_SOURCE,
        "Failed to get 2D context from off-screen canvas"
      );
      tempRenderTexture.destroy();
      return;
    }
    // Drawing the RenderTexture onto the canvas might require accessing its canvas or snapshotting
    // Let's try snapshotting the whole texture
    tempRenderTexture.snapshot(
      (snapshotImage: Phaser.Display.Color | HTMLImageElement) => {
        if (snapshotImage instanceof HTMLImageElement) {
          ctx.drawImage(snapshotImage, 0, 0);
          Logger.info(
            LOGGER_SOURCE,
            "Drew RenderTexture snapshot onto off-screen canvas."
          );

          // 4. Add the canvas to the Texture Manager as a static texture
          if (this.scene.textures.exists(STARFIELD_TEXTURE_KEY)) {
            this.scene.textures.remove(STARFIELD_TEXTURE_KEY);
            Logger.info(
              LOGGER_SOURCE,
              `Removed existing texture: ${STARFIELD_TEXTURE_KEY}`
            );
          }
          this.scene.textures.addCanvas(STARFIELD_TEXTURE_KEY, canvas);
          Logger.info(
            LOGGER_SOURCE,
            `Added canvas to texture manager with key: ${STARFIELD_TEXTURE_KEY}`
          );

          // 5. Destroy the temporary RenderTexture (no longer needed)
          tempRenderTexture.destroy();

          // 6. Create the TileSprite (only if texture was added successfully)
          if (this.scene.textures.exists(STARFIELD_TEXTURE_KEY)) {
            this.createTileSpriteFromTexture();
          } else {
            Logger.error(
              LOGGER_SOURCE,
              `Failed to add canvas texture ${STARFIELD_TEXTURE_KEY}, cannot create TileSprite.`
            );
          }
        } else {
          Logger.error(
            LOGGER_SOURCE,
            "RenderTexture snapshot was not an HTMLImageElement"
          );
          tempRenderTexture.destroy(); // Clean up RT
        }
      }
    );

    // TileSprite creation is now handled within the snapshot callback
    // Logger.info(LOGGER_SOURCE, "Created TileSprite from saved texture.");

    // Initial draw of background
    // this.drawBackgroundFill(); // Moved to createTileSpriteFromTexture
  }

  // Extracted TileSprite creation logic
  private createTileSpriteFromTexture(): void {
    // Destroy previous TileSprite if it exists
    if (this.tileSprite) {
      this.tileSprite.destroy();
    }
    const { width, height } = this.scene.scale; // Use initial screen size
    this.tileSprite = this.scene.add.tileSprite(
      0,
      0,
      width,
      height,
      STARFIELD_TEXTURE_KEY
    );
    this.tileSprite.setOrigin(0, 0);
    this.tileSprite.setScrollFactor(0);
    this.tileSprite.setDepth(this.config.depth);
    Logger.info(LOGGER_SOURCE, "Created TileSprite from canvas texture.");

    // Initial draw of background
    this.drawBackgroundFill();
  }

  private handleResize(): void {
    if (this.isDestroyed || !this.tileSprite) return;
    const width = this.scene.scale.width;
    const height = this.scene.scale.height;
    Logger.info(LOGGER_SOURCE, `Handling resize event: ${width}x${height}`);

    // Resize the TileSprite to cover the new screen size
    this.tileSprite.setSize(width, height);

    // Redraw the background fill
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

  // Render method is no longer needed as TileSprite handles rendering
  /*
  public render(): void {
    ...
  }
  */

  public updateConfig(newConfig: Partial<StarFieldRendererConfig>): void {
    if (this.isDestroyed) return;
    const oldDepth = this.config.depth;
    const oldBgColor = this.config.backgroundColor;

    this.config = { ...this.config, ...newConfig };

    if (this.tileSprite && oldDepth !== this.config.depth) {
      this.tileSprite.setDepth(this.config.depth);
    }
    if (this.backgroundGraphics && oldDepth !== this.config.depth) {
      this.backgroundGraphics.setDepth(this.config.depth - 1);
    }

    if (oldBgColor !== this.config.backgroundColor) {
      if (this.config.backgroundColor && !this.backgroundGraphics) {
        this.backgroundGraphics = this.scene.add.graphics();
        this.backgroundGraphics.setDepth(this.config.depth - 1);
      } else if (!this.config.backgroundColor && this.backgroundGraphics) {
        this.backgroundGraphics.destroy();
        this.backgroundGraphics = null;
      }
    }

    Logger.info(
      LOGGER_SOURCE,
      `TileSprite Renderer config updated: ${JSON.stringify(this.config)}`
    );
    this.drawBackgroundFill();
    // Note: Changes to StarField density/seed require recreating the StarField instance
    // and then calling createTextureAndTileSprite() again on the renderer.
  }

  public destroy(): void {
    if (this.isDestroyed) return;
    this.isDestroyed = true;
    if (this.tileSprite) {
      this.tileSprite.destroy();
      this.tileSprite = null;
    }
    if (this.backgroundGraphics) {
      this.backgroundGraphics.destroy();
      this.backgroundGraphics = null;
    }
    // Remove texture if it exists
    if (this.scene && this.scene.textures.exists(STARFIELD_TEXTURE_KEY)) {
      this.scene.textures.remove(STARFIELD_TEXTURE_KEY);
    }
    if (this.scene && this.scene.scale && this.boundHandleResize) {
      this.scene.scale.off("resize", this.boundHandleResize);
    }
    Logger.info(LOGGER_SOURCE, "Destroyed TileSprite StarFieldRenderer");
  }

  // Update loop is now very simple
  public update(time: number, delta: number): void {
    if (this.isDestroyed || !this.tileSprite) return;

    // Update background fill position (if it exists)
    this.drawBackgroundFill(); // Needs to happen every frame if camera moves

    // Update the TileSprite's tilePosition based on camera scroll
    const camera = this.scene.cameras.main;
    this.tileSprite.setTilePosition(camera.scrollX, camera.scrollY);

    // No need to update StarField unless twinkling is re-enabled later
    // No explicit render call needed for TileSprite
  }

  // Removed redrawStarTexture method
}
