import Phaser from "phaser";
import { ComponentBase } from "../core/IComponent";
import { GameObject } from "../core/GameObject";
import { Logger } from "@one-button-to-space/shared";

const LOGGER_SOURCE = "🎨"; // Artist palette emoji

export interface SpriteRendererConfig {
  texture: string;
  frame?: string | number;
  tint?: number;
  origin?: { x: number; y: number };
  depth?: number;
  scale?: { x: number; y: number };
  visualOffsetY?: number; // Optional offset for visual vs physics body
}

/**
 * Renders a Phaser Sprite or Image for a GameObject.
 * Updates the visual's transform to match the GameObject's world transform.
 */
export class SpriteRenderer extends ComponentBase {
  private sprite: Phaser.GameObjects.Image | Phaser.GameObjects.Sprite;
  private config: SpriteRendererConfig;

  constructor(config: SpriteRendererConfig) {
    super();
    this.config = {
      // Set defaults
      origin: { x: 0.5, y: 0.5 },
      depth: 0,
      scale: { x: 1, y: 1 },
      visualOffsetY: 0,
      ...config, // Override with provided config
    };
    // Logger.debug(LOGGER_SOURCE, "SpriteRenderer constructed with config:", this.config);
  }

  awake(): void {
    super.awake(); // Call base awake if needed
    const worldX = this.gameObject.getWorldX();
    const worldY =
      this.gameObject.getWorldY() + (this.config.visualOffsetY || 0);

    // Use Image for static, Sprite if frame animation might be needed later
    // For now, Image is simpler if no frame is specified.
    if (this.config.frame !== undefined) {
      this.sprite = this.gameObject.scene.add.sprite(
        worldX,
        worldY,
        this.config.texture,
        this.config.frame
      );
      // Logger.debug(LOGGER_SOURCE, `Sprite created for ${this.gameObject.name}`);
    } else {
      this.sprite = this.gameObject.scene.add.image(
        worldX,
        worldY,
        this.config.texture
      );
      // Logger.debug(LOGGER_SOURCE, `Image created for ${this.gameObject.name}`);
    }

    this.sprite.setOrigin(this.config.origin!.x, this.config.origin!.y);
    this.sprite.setDepth(this.config.depth!);
    this.sprite.setScale(this.config.scale!.x, this.config.scale!.y);

    if (this.config.tint !== undefined) {
      this.sprite.setTint(this.config.tint);
      // Logger.debug(LOGGER_SOURCE, `Tint applied: 0x${this.config.tint.toString(16)}`);
    }

    // Initial transform sync
    this.updateTransform();
    // Logger.debug(LOGGER_SOURCE, `SpriteRenderer awake complete for ${this.gameObject.name}`);
  }

  update(deltaTimeS: number): void {
    super.update(deltaTimeS); // Call base update if needed
    if (!this.active || !this.sprite?.active) return;
    this.updateTransform();
  }

  destroy(): void {
    // Logger.debug(LOGGER_SOURCE, `Destroying SpriteRenderer for ${this.gameObject?.name}`);
    if (this.sprite) {
      this.sprite.destroy();
      // Logger.debug(LOGGER_SOURCE, `Phaser sprite/image destroyed`);
      // Explicitly nullify to help GC and prevent accidental use
      // @ts-ignore
      this.sprite = null;
    }
    super.destroy(); // Call base destroy
  }

  private updateTransform(): void {
    // Update sprite position and rotation based on GameObject's world transform
    // Note: GameObject world transform needs implementation for parent rotation/scale
    const worldX = this.gameObject.getWorldX();
    const worldY =
      this.gameObject.getWorldY() + (this.config.visualOffsetY || 0);
    const worldRotation = this.gameObject.rotation; // Assuming rotation is world for now

    this.sprite.x = worldX;
    this.sprite.y = worldY;
    this.sprite.rotation = worldRotation;

    // Handle scale separately if needed (local vs world)
    this.sprite.scaleX = this.gameObject.scaleX * this.config.scale!.x;
    this.sprite.scaleY = this.gameObject.scaleY * this.config.scale!.y;
  }

  // --- Public Methods to Interact with the Sprite ---

  public setVisible(visible: boolean): void {
    if (this.sprite) {
      this.sprite.setVisible(visible);
    }
  }

  public setTexture(texture: string, frame?: string | number): void {
    if (this.sprite) {
      this.sprite.setTexture(texture, frame);
      this.config.texture = texture;
      this.config.frame = frame;
    }
  }

  public setTint(tint: number): void {
    if (this.sprite) {
      this.sprite.setTint(tint);
      this.config.tint = tint;
    }
  }

  public setScale(x: number, y?: number): void {
    if (this.sprite) {
      this.config.scale = { x: x, y: y ?? x };
      // updateTransform will apply this combined with GameObject scale
    }
  }
}
