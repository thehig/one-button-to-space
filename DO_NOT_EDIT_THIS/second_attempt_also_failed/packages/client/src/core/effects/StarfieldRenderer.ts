import Phaser from "phaser";
import { Starfield } from "./Starfield";
import { Logger } from "@one-button-to-space/shared";

const LOGGER_SOURCE = "✨🌌 StarRender";

interface StarfieldRendererConfig {
  textureKey: string;
  depth: number;
  backgroundColor: string | null; // Optional background color for the texture itself
}

const DEFAULT_RENDER_CONFIG: StarfieldRendererConfig = {
  textureKey: "starfieldTexture",
  depth: -10,
  backgroundColor: "#000011", // Dark blue background
};

export class StarfieldRenderer {
  private scene: Phaser.Scene;
  private starfield: Starfield;
  private config: StarfieldRendererConfig;
  private tileSprite: Phaser.GameObjects.TileSprite | null = null;
  private isDestroyed: boolean = false;
  private textureCreated: boolean = false;

  constructor(
    scene: Phaser.Scene,
    starfield: Starfield,
    config: Partial<StarfieldRendererConfig> = {}
  ) {
    this.scene = scene;
    this.starfield = starfield;
    this.config = { ...DEFAULT_RENDER_CONFIG, ...config };

    // Texture creation is separated
  }

  // Call this method after Starfield is ready
  public createTexture(): void {
    if (this.textureCreated || this.isDestroyed) {
      Logger.warn(
        LOGGER_SOURCE,
        "Texture already created or renderer destroyed."
      );
      return;
    }

    // Check if texture already exists (e.g., from previous scene run)
    if (this.scene.textures.exists(this.config.textureKey)) {
      Logger.info(
        LOGGER_SOURCE,
        `Texture ${this.config.textureKey} already exists. Reusing.`
      );
      this.textureCreated = true;
      return; // Don't recreate if it exists
    }

    Logger.info(LOGGER_SOURCE, `Creating texture: ${this.config.textureKey}`);

    // Use a temporary Graphics object to draw
    const gfx = this.scene.make.graphics({ x: 0, y: 0 });

    // Optional: Fill background of the texture itself
    if (this.config.backgroundColor) {
      try {
        const bgColor = Phaser.Display.Color.ValueToColor(
          this.config.backgroundColor
        );
        gfx.fillStyle(bgColor.color, bgColor.alphaGL);
        gfx.fillRect(
          0,
          0,
          this.starfield.config.textureWidth,
          this.starfield.config.textureHeight
        );
      } catch (e) {
        Logger.error(
          LOGGER_SOURCE,
          `Invalid background color: ${this.config.backgroundColor}`,
          e
        );
      }
    }

    // Draw stars
    const stars = this.starfield.getStars();
    stars.forEach((star) => {
      try {
        const starColor = Phaser.Display.Color.ValueToColor(star.color);
        gfx.fillStyle(starColor.color, star.alpha); // Use pre-calculated alpha
        gfx.fillCircle(star.x, star.y, star.size);
      } catch (e) {
        Logger.warn(
          LOGGER_SOURCE,
          `Failed to parse star color: ${star.color}`,
          e
        );
        gfx.fillStyle(0xffffff, star.alpha);
        gfx.fillCircle(star.x, star.y, star.size);
      }
    });

    // Generate the texture from the Graphics object
    gfx.generateTexture(
      this.config.textureKey,
      this.starfield.config.textureWidth,
      this.starfield.config.textureHeight
    );

    gfx.destroy(); // Clean up temporary graphics object
    this.textureCreated = true;
    Logger.info(LOGGER_SOURCE, `Texture ${this.config.textureKey} created.`);
  }

  // Call this after createTexture()
  public createTileSprite(): void {
    if (!this.textureCreated || this.isDestroyed || this.tileSprite) {
      Logger.warn(
        LOGGER_SOURCE,
        "Texture not created, renderer destroyed, or TileSprite already exists."
      );
      return;
    }

    if (!this.scene.textures.exists(this.config.textureKey)) {
      Logger.error(
        LOGGER_SOURCE,
        `Texture ${this.config.textureKey} not found. Cannot create TileSprite.`
      );
      return;
    }

    const { width, height } = this.scene.scale;
    const displayWidth = width * 4;
    const displayHeight = height * 4;

    // Calculate position to center the larger sprite
    const x = width / 2 - displayWidth / 2;
    const y = height / 2 - displayHeight / 2;

    this.tileSprite = this.scene.add.tileSprite(
      x,
      y,
      displayWidth,
      displayHeight,
      this.config.textureKey
    );
    this.tileSprite.setOrigin(0, 0); // Origin remains top-left for TileSprite positioning
    this.tileSprite.setScrollFactor(0); // Fixed position relative to the camera
    this.tileSprite.setDepth(this.config.depth);

    Logger.info(LOGGER_SOURCE, "TileSprite created.");

    // Add resize listener
    this.scene.scale.on("resize", this.handleResize, this);
  }

  private handleResize(gameSize: Phaser.Structs.Size): void {
    if (this.isDestroyed || !this.tileSprite) return;

    const displayWidth = gameSize.width * 4;
    const displayHeight = gameSize.height * 4;

    // Recalculate position to re-center
    const x = gameSize.width / 2 - displayWidth / 2;
    const y = gameSize.height / 2 - displayHeight / 2;

    this.tileSprite.setPosition(x, y);
    this.tileSprite.setSize(displayWidth, displayHeight);

    Logger.debug(
      LOGGER_SOURCE,
      `TileSprite resized to ${displayWidth}x${displayHeight} at (${x}, ${y})`
    );
  }

  public update(): void {
    if (this.isDestroyed || !this.tileSprite) return;

    // Make the texture scroll parallax with the camera
    const camera = this.scene.cameras.main;
    // Adjust the divisor for parallax effect (0.5 = half speed, etc.)
    this.tileSprite.setTilePosition(camera.scrollX * 0.5, camera.scrollY * 0.5);
  }

  public destroy(): void {
    if (this.isDestroyed) return;
    this.isDestroyed = true;

    this.scene.scale.off("resize", this.handleResize, this);

    if (this.tileSprite) {
      this.tileSprite.destroy();
      this.tileSprite = null;
    }

    // Optionally remove the texture - maybe keep for reuse?
    // if (this.scene.textures.exists(this.config.textureKey)) {
    //   this.scene.textures.remove(this.config.textureKey);
    // }

    Logger.info(LOGGER_SOURCE, "Destroyed StarfieldRenderer.");
  }
}
