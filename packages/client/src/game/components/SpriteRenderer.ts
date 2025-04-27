import Phaser from "phaser";
import { IComponent } from "../core/IComponent";
import { GameObject } from "../core/GameObject"; // Needs GameObject for reference
import { Logger } from "@one-button-to-space/shared";

const LOGGER_SOURCE = "🎨"; // Artist palette emoji

export class SpriteRenderer implements IComponent {
  public gameObject: GameObject | null = null; // Set by GameObject

  // --- Component Properties ---
  public phaserSprite: Phaser.GameObjects.Sprite | null = null;
  public textureKey: string;
  public frame?: string | number;
  public depth: number = 0;
  public visible: boolean = true;
  public tint: number = 0xffffff; // White tint by default

  // Keep track if Phaser object creation failed
  private creationFailed: boolean = false;

  constructor(textureKey: string, frame?: string | number, depth: number = 0) {
    this.textureKey = textureKey;
    this.frame = frame;
    this.depth = depth;
  }

  awake(): void {
    if (!this.gameObject) {
      Logger.error(
        LOGGER_SOURCE,
        "SpriteRenderer awake called before gameObject is set!"
      );
      this.creationFailed = true;
      return;
    }

    Logger.debug(
      LOGGER_SOURCE,
      `SpriteRenderer awake on ${this.gameObject.name}. Creating Phaser Sprite...`
    );

    try {
      // Create the Phaser Sprite using the GameObject's scene context
      this.phaserSprite = this.gameObject.scene.add.sprite(
        this.gameObject.x, // Initial position from GameObject
        this.gameObject.y,
        this.textureKey,
        this.frame
      );

      // Apply initial properties
      this.phaserSprite.setDepth(this.depth);
      this.phaserSprite.setRotation(this.gameObject.rotation);
      this.phaserSprite.setScale(
        this.gameObject.scaleX,
        this.gameObject.scaleY
      );
      this.phaserSprite.setVisible(this.visible);
      this.phaserSprite.setTint(this.tint);
      // TODO: Add anchor setting if needed

      Logger.debug(
        LOGGER_SOURCE,
        `Phaser Sprite created for ${this.gameObject.name}.`
      );
    } catch (error) {
      Logger.error(
        LOGGER_SOURCE,
        `Failed to create Phaser Sprite for ${this.gameObject.name}:`,
        error
      );
      this.creationFailed = true;
    }
  }

  start(): void {
    // Optional: Can be used for logic after all components are initialized
    // Logger.debug(LOGGER_SOURCE, `SpriteRenderer start on ${this.gameObject?.name}`);
  }

  update(deltaTimeS: number): void {
    if (
      !this.phaserSprite ||
      !this.gameObject ||
      this.creationFailed ||
      !this.gameObject.active
    ) {
      // If creation failed, GO is null, or GO inactive, don't update sprite
      if (
        this.phaserSprite &&
        !this.gameObject?.active &&
        this.phaserSprite.visible
      ) {
        this.phaserSprite.setVisible(false); // Hide if GO becomes inactive
      }
      return;
    }

    // Ensure visibility matches component state (if GO is active)
    if (this.phaserSprite.visible !== this.visible) {
      this.phaserSprite.setVisible(this.visible);
    }
    if (!this.visible) return; // Don't update properties if not visible

    // Sync Phaser Sprite properties with GameObject transform and component state
    this.phaserSprite.setPosition(this.gameObject.x, this.gameObject.y);
    this.phaserSprite.setRotation(this.gameObject.rotation);
    this.phaserSprite.setScale(this.gameObject.scaleX, this.gameObject.scaleY);
    this.phaserSprite.setDepth(this.depth); // Update depth if it changed
    this.phaserSprite.setTint(this.tint); // Update tint if it changed

    // Check if texture needs changing
    if (
      this.phaserSprite.texture.key !== this.textureKey ||
      this.phaserSprite.frame.name !== this.frame?.toString()
    ) {
      try {
        this.phaserSprite.setTexture(this.textureKey, this.frame);
        Logger.debug(
          LOGGER_SOURCE,
          `Sprite texture updated to ${this.textureKey}:${this.frame} on ${this.gameObject.name}`
        );
      } catch (error) {
        Logger.error(
          LOGGER_SOURCE,
          `Failed to set texture ${this.textureKey}:${this.frame} on ${this.gameObject.name}`,
          error
        );
        // Optionally revert textureKey/frame or handle error
      }
    }
  }

  // fixedUpdate(fixedDeltaTimeS: number): void {
  //   // Not typically needed for rendering updates
  // }

  destroy(): void {
    Logger.debug(
      LOGGER_SOURCE,
      `SpriteRenderer destroy on ${this.gameObject?.name}`
    );
    if (this.phaserSprite) {
      try {
        this.phaserSprite.destroy(); // Clean up the Phaser object
        Logger.debug(
          LOGGER_SOURCE,
          `Phaser Sprite destroyed for ${this.gameObject?.name}`
        );
      } catch (error) {
        Logger.error(
          LOGGER_SOURCE,
          `Error destroying Phaser Sprite for ${this.gameObject?.name}:`,
          error
        );
      }
      this.phaserSprite = null;
    }
    this.gameObject = null; // Clear reference
  }

  // --- Helper methods for this component ---

  public setTexture(textureKey: string, frame?: string | number): void {
    this.textureKey = textureKey;
    this.frame = frame;
    // Update will handle applying it to the phaserSprite on the next frame
    Logger.debug(
      LOGGER_SOURCE,
      `Texture set to ${textureKey}:${frame} queued for ${this.gameObject?.name}`
    );
  }

  public setDepth(depth: number): void {
    this.depth = depth;
    // Update will handle applying it
  }

  public setVisible(visible: boolean): void {
    this.visible = visible;
    // Update will handle applying it
  }

  public setTint(tint: number): void {
    this.tint = tint;
    // Update will handle applying it
  }
}
