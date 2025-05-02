import Phaser from "phaser";
import { BaseManager } from "./BaseManager";
import { Logger } from "@one-button-to-space/shared";
// Removed InputManager import as direct key state checks are less reliable here
import { GameObject } from "../core/GameObject"; // Type for the target
import { EngineManager } from "./EngineManager"; // Added EngineManager import

const LOGGER_SOURCE = "📷🎥"; // Camera emojis

interface CameraManagerConfig {
  minZoom: number;
  maxZoom: number;
  zoomSpeedScroll: number; // How much scroll affects zoom
  followLerp: number; // Camera follow speed (0-1, lower is smoother/slower)
  zoomDuration: number; // Default smooth zoom duration in ms
}

const DEFAULT_CONFIG: CameraManagerConfig = {
  minZoom: 0.25,
  maxZoom: 3.0,
  zoomSpeedScroll: 0.001,
  followLerp: 0.1, // Adjust for desired smoothness
  zoomDuration: 50, // Default smooth zoom duration
};

export class CameraManager extends BaseManager {
  // Removed Singleton pattern
  // protected static _instance: CameraManager | null = null;
  private config: CameraManagerConfig;
  private target: GameObject | null = null;
  private camera: Phaser.Cameras.Scene2D.Camera | null = null;
  private _currentZoom: number = 1;
  private scene: Phaser.Scene | null = null;
  private engineManager: EngineManager; // Added EngineManager instance variable

  // Modified constructor to accept EngineManager and config
  constructor(
    engineManager: EngineManager,
    config: Partial<CameraManagerConfig> = {}
  ) {
    super();
    this.engineManager = engineManager;
    this.config = { ...DEFAULT_CONFIG, ...config };
    this._currentZoom = 1; // Start at default zoom
    Logger.info(LOGGER_SOURCE, "CameraManager initialized.");
    // Scene context and camera assignment happen in setup/setSceneContext
  }

  // Removed Singleton getInstance
  // public static getInstance(): CameraManager { ... }

  // --- Lifecycle Methods ---

  public async setup(): Promise<void> {
    // Setup waits for scene context
    Logger.info(
      LOGGER_SOURCE,
      "CameraManager setup initialized. Waiting for scene context..."
    );
  }

  public teardown(): void {
    Logger.info(LOGGER_SOURCE, "Tearing down CameraManager...");
    if (this.scene?.input) {
      this.scene.input.off("wheel", this.handleZoom, this);
    }
    this.target = null;
    this.camera = null;
    this.scene = null; // Clear scene reference
    Logger.info(LOGGER_SOURCE, "CameraManager teardown complete.");
  }

  // Set the scene context, usually called by SceneManager or GameManager
  public setSceneContext(scene: Phaser.Scene | null): void {
    if (this.scene === scene) return; // Avoid redundant setup

    // Clean up listeners from previous scene if any
    if (this.scene?.input) {
      this.scene.input.off("wheel", this.handleZoom, this);
    }

    this.scene = scene;
    if (this.scene) {
      this.camera = this.scene.cameras.main;
      if (this.camera) {
        this._currentZoom = this.camera.zoom; // Initialize zoom from camera
        // Add zoom listener to the new scene's input
        this.scene.input.on("wheel", this.handleZoom, this);
        Logger.info(
          LOGGER_SOURCE,
          `CameraManager context set to scene: ${
            this.scene.scene.key
          }. Zoom: ${this._currentZoom.toFixed(2)}`
        );
      } else {
        Logger.error(
          LOGGER_SOURCE,
          "Main camera not found on new scene context."
        );
        this._currentZoom = 1; // Default zoom
      }
    } else {
      // Scene is being set to null (e.g., during shutdown)
      this.camera = null;
      this.target = null;
      this._currentZoom = 1;
      Logger.info(LOGGER_SOURCE, "CameraManager scene context cleared.");
    }

    // Reset target when scene context changes?
    // this.target = null;
  }

  // --- Target Management ---

  public setTarget(target: GameObject | null): void {
    if (target === this.target) return; // No change

    this.target = target;
    if (this.target && this.camera) {
      // Optionally snap camera immediately to target on set
      // this.camera.centerOn(this.target.x, this.target.y);
      Logger.info(
        LOGGER_SOURCE,
        `Camera target set to ${target?.name || "GameObject (no name)"}` // Improved logging
      );
    } else if (!this.target) {
      Logger.info(LOGGER_SOURCE, "Camera target cleared.");
    }
  }

  // --- Zoom Management ---

  public get currentZoom(): number {
    return this._currentZoom;
  }

  public getMinZoom(): number {
    return this.config.minZoom;
  }

  public getMaxZoom(): number {
    return this.config.maxZoom;
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

    // Check if the change is significant enough to warrant an update
    if (Math.abs(newZoom - this._currentZoom) > 0.001) {
      this.zoomTo(newZoom, this.config.zoomDuration); // Use configured duration
    }
  }

  /**
   * Smoothly zooms the camera to a specific level.
   * @param level The target zoom level.
   * @param duration Duration of the zoom animation in ms (defaults to config.zoomDuration).
   */
  public zoomTo(level: number, duration?: number): void {
    if (!this.camera) return;

    const targetDuration = duration ?? this.config.zoomDuration;

    const clampedLevel = Phaser.Math.Clamp(
      level,
      this.config.minZoom,
      this.config.maxZoom
    );

    // Only start tween if the target level is different enough
    if (
      Math.abs(clampedLevel - this._currentZoom) < 0.001 &&
      targetDuration > 0
    ) {
      // console.trace("Camera zoomTo skipped, already at target level.");
      return;
    }

    this._currentZoom = clampedLevel; // Update internal state immediately

    if (targetDuration > 0) {
      this.camera.zoomTo(
        this._currentZoom,
        targetDuration,
        Phaser.Math.Easing.Sine.InOut // Example easing
      );
    } else {
      this.camera.setZoom(this._currentZoom);
    }
    // Logger.trace(LOGGER_SOURCE, `Zooming camera to ${this._currentZoom.toFixed(2)}`);
  }

  // --- Update Loop ---

  public update(time: number, delta: number): void {
    if (!this.camera || !this.target) {
      // Optional: log a warning if target is missing when expected
      // if (!this.target) Logger.trace(LOGGER_SOURCE, 'Camera update skipped, no target.');
      return;
    }

    // Follow target using configured method (e.g., centerOn or lerp)
    this.followTarget(this.target);

    // Add any other camera effects or updates here
  }

  private followTarget(target: GameObject): void {
    if (!this.camera) return;
    // Ensure the target's body exists before accessing position
    if (!target.body) {
      // Logger.trace(LOGGER_SOURCE, "Camera follow skipped, target body not ready.");
      return;
    }

    // Use optional chaining just in case, though the body check should suffice
    const targetX =
      target.body?.position?.x ?? this.camera.scrollX + this.camera.width / 2;
    const targetY =
      target.body?.position?.y ?? this.camera.scrollY + this.camera.height / 2;

    // --- Choose Follow Method --- //

    // 1. Instant Center On (Jittery but precise)
    this.camera.centerOn(targetX, targetY);

    // 2. Smooth Follow (Lerp - needs adjustment in coordinate systems)
    // Note: Lerping scrollX/scrollY might feel better than lerping centerOn
    // const lerpSpeed = this.config.followLerp * (this.engineManager.getTimeManager().delta / 16.666); // Adjust lerp based on delta time
    // this.camera.scrollX = Phaser.Math.Linear(this.camera.scrollX, targetX - this.camera.displayWidth / 2, lerpSpeed);
    // this.camera.scrollY = Phaser.Math.Linear(this.camera.scrollY, targetY - this.camera.displayHeight / 2, lerpSpeed);

    // 3. Phaser's built-in follow (can be configured with lerp)
    // If using this, call camera.startFollow(target, roundPixels, lerpX, lerpY) once in setTarget
    // and remove manual centering/lerping from update.
  }

  // Removed BaseManager overrides
  // public override init(): void { ... }
  // public override destroy(): void { ... }
}
