import Phaser from "phaser";
import { BaseManager } from "./BaseManager";
import { Logger } from "@one-button-to-space/shared";
import { InputManager } from "./InputManager"; // Need InputManager if using its key states for zoom
import { GameObject } from "../core/GameObject"; // Type for the target

const LOGGER_SOURCE = "📷🎥"; // Camera emojis

interface CameraManagerConfig {
  minZoom: number;
  maxZoom: number;
  zoomSpeedScroll: number; // How much scroll affects zoom
  followLerp: number; // Camera follow speed (0-1, lower is smoother/slower)
}

const DEFAULT_CONFIG: CameraManagerConfig = {
  minZoom: 0.5,
  maxZoom: 3.0,
  zoomSpeedScroll: 0.001,
  followLerp: 0.1, // Adjust for desired smoothness
};

export class CameraManager extends BaseManager {
  protected static _instance: CameraManager | null = null;
  private config: CameraManagerConfig;
  private target: GameObject | null = null;
  private camera: Phaser.Cameras.Scene2D.Camera | null = null;
  private _currentZoom: number = 1;
  private scene: Phaser.Scene | null = null; // Declare scene property

  private constructor(config: Partial<CameraManagerConfig> = {}) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
    this._currentZoom = 1; // Start at default zoom
    Logger.info(LOGGER_SOURCE, "CameraManager initialized.");
  }

  public static getInstance(): CameraManager {
    if (!CameraManager._instance) {
      CameraManager._instance = new CameraManager();
    }
    return CameraManager._instance;
  }

  public setSceneContext(scene: Phaser.Scene): void {
    this.scene = scene; // Store the scene context directly
    if (!this.scene) {
      Logger.error(LOGGER_SOURCE, "Scene context is null after assignment."); // Adjusted error message
      return;
    }
    this.camera = this.scene.cameras.main;
    // Check if camera exists before accessing zoom
    if (this.camera) {
      this._currentZoom = this.camera.zoom; // Initialize zoom from camera
    } else {
      Logger.warn(LOGGER_SOURCE, "Main camera not found on scene context.");
      this._currentZoom = 1; // Default zoom
    }
    this.target = null; // Reset target on new scene context

    // Add zoom listener directly to the scene's input
    this.scene.input.on("wheel", this.handleZoom, this);
    Logger.info(
      LOGGER_SOURCE,
      `Scene context set. Main camera assigned. Current zoom: ${this._currentZoom.toFixed(
        2
      )}`
    );
  }

  public setTarget(target: GameObject | null): void {
    if (target === this.target) return; // No change

    this.target = target;
    if (this.target && this.camera) {
      // Optionally snap camera immediately to target on set
      // this.camera.centerOn(this.target.x, this.target.y);
      Logger.info(
        LOGGER_SOURCE,
        `Camera target set to ${target?.name || "null"}`
      );
    } else {
      Logger.info(LOGGER_SOURCE, "Camera target cleared.");
    }
  }

  public get currentZoom(): number {
    return this._currentZoom;
  }

  private handleZoom(
    pointer: Phaser.Input.Pointer,
    gameObjects: Phaser.GameObjects.GameObject[],
    deltaX: number,
    deltaY: number,
    deltaZ: number
  ): void {
    if (!this.camera) return;

    // deltaY is typically negative for zooming in (wheel up), positive for out (wheel down)
    const zoomAmount = -deltaY * this.config.zoomSpeedScroll;
    let newZoom = this._currentZoom + zoomAmount;

    // Clamp zoom level
    newZoom = Phaser.Math.Clamp(
      newZoom,
      this.config.minZoom,
      this.config.maxZoom
    );

    if (Math.abs(newZoom - this._currentZoom) > 0.001) {
      // Avoid tiny adjustments
      this.zoomTo(newZoom, 50); // Smooth zoom over 50ms
    }
  }

  /**
   * Smoothly zooms the camera to a specific level.
   * @param level The target zoom level.
   * @param duration Duration of the zoom animation in ms (default: 0, immediate).
   */
  public zoomTo(level: number, duration: number = 0): void {
    if (!this.camera) return;

    const clampedLevel = Phaser.Math.Clamp(
      level,
      this.config.minZoom,
      this.config.maxZoom
    );

    if (Math.abs(clampedLevel - this._currentZoom) < 0.001 && duration > 0)
      return; // Already at target

    this._currentZoom = clampedLevel;

    if (duration > 0) {
      this.camera.zoomTo(
        this._currentZoom,
        duration,
        Phaser.Math.Easing.Sine.InOut
      );
    } else {
      this.camera.setZoom(this._currentZoom);
    }
    // Logger.trace(LOGGER_SOURCE, `Zooming camera to ${this._currentZoom.toFixed(2)}`);
  }

  public update(time: number, delta: number): void {
    if (!this.camera) return;

    // Follow target smoothly
    if (this.target) {
      this.camera.centerOn(
        this.target.x, // Use interpolated position
        this.target.y
      );
      // Smoother follow (Lerp)
      // this.camera.scrollX = Phaser.Math.Linear(this.camera.scrollX, this.target.x - this.camera.width / 2, this.config.followLerp);
      // this.camera.scrollY = Phaser.Math.Linear(this.camera.scrollY, this.target.y - this.camera.height / 2, this.config.followLerp);
    }

    // Add any other camera effects or updates here
  }

  public override destroy(): void {
    Logger.info(LOGGER_SOURCE, "Destroying CameraManager...");
    // Use optional chaining for safety
    if (this.scene?.input) {
      this.scene.input.off("wheel", this.handleZoom, this);
    }
    this.target = null;
    this.camera = null;
    this.scene = null; // Clear scene reference
    super.destroy();
  }
}
