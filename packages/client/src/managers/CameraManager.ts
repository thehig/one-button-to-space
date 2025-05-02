import Phaser from "phaser";
import { BaseManager } from "./BaseManager";
import { Logger } from "@one-button-to-space/shared";
import { InputManager } from "./InputManager"; // Need InputManager if using its key states for zoom
import { GameObject } from "../core/GameObject"; // Type for the target
import { GameManagerRegistry } from "./GameManagerRegistry"; // Import registry

const LOGGER_SOURCE = "📷🎥"; // Camera emojis

interface CameraManagerConfig {
  minZoom: number;
  maxZoom: number;
  zoomSpeedScroll: number; // How much scroll affects zoom
  followLerp: number; // Camera follow speed (0-1, lower is smoother/slower)
}

const DEFAULT_CONFIG: CameraManagerConfig = {
  minZoom: 0.25,
  maxZoom: 3.0,
  zoomSpeedScroll: 0.001,
  followLerp: 0.1, // Adjust for desired smoothness
};

export class CameraManager extends BaseManager {
  protected static override _instance: CameraManager | null = null;
  private config: CameraManagerConfig;
  private target: GameObject | null = null;
  private camera: Phaser.Cameras.Scene2D.Camera | null = null;
  private _currentZoom: number = 1;
  private scene: Phaser.Scene | null = null; // Declare scene property
  private isDragging: boolean = false;
  private lastDragPoint: Phaser.Math.Vector2 | null = null;
  private targetJustSet: boolean = false; // Flag to delay following

  protected constructor(config: Partial<CameraManagerConfig> = {}) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
    this._currentZoom = 1; // Start at default zoom
    Logger.info(LOGGER_SOURCE, "CameraManager initialized.");
    this.update(0, 0); // Initialize camera state
  }

  public static getInstance(): CameraManager {
    if (!CameraManager._instance) {
      CameraManager._instance = new CameraManager();
      GameManagerRegistry.getInstance().registerManager(
        CameraManager._instance
      );
    }
    return CameraManager._instance;
  }

  public static resetInstance(): void {
    if (CameraManager._instance) {
      Logger.debug(LOGGER_SOURCE, "Resetting CameraManager instance.");
      CameraManager._instance.cleanup(false); // Pass false for full reset
      CameraManager._instance = null;
    } else {
      Logger.trace(
        LOGGER_SOURCE,
        "CameraManager instance already null, skipping reset."
      );
    }
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
    this.targetJustSet = true; // Set flag when target changes
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
    // Add check for valid target and body at the start
    if (!this.target || !this.target.body || !this.scene?.cameras?.main) {
      Logger.trace(
        LOGGER_SOURCE,
        `Camera update skipped: Target=${
          this.target ? this.target.name : "null"
        }, Body=${this.target?.body ? "exists" : "null"}, Camera=${
          this.scene?.cameras?.main ? "exists" : "null"
        }`
      );
      return; // Exit if target, body, or camera isn't ready
    }

    // Skip the first update frame after target is set
    if (this.targetJustSet) {
      Logger.trace(
        LOGGER_SOURCE,
        "Skipping camera follow for one frame after target set."
      );
      this.targetJustSet = false; // Reset flag for next frame
      return;
    }

    const camera = this.scene.cameras.main; // Camera is guaranteed to exist here

    // Refined log
    Logger.trace(
      LOGGER_SOURCE,
      `Update: Target=${this.target.name}, TargetPos=(${this.target.x.toFixed(
        1
      )}, ${this.target.y.toFixed(
        1
      )}), BodyPos=(${this.target.body.position.x.toFixed(
        1 // Access body position directly
      )}, ${this.target.body.position.y.toFixed(1)}), Dragging=${
        this.isDragging
      }`
    );

    if (!this.isDragging) {
      // Only follow if not dragging
      // Use lerp for smooth following

      // Follow target smoothly using GameObject position (more reliable immediately after creation)
      const targetX = this.target.x;
      const targetY = this.target.y;

      camera.centerOn(targetX, targetY);

      // Smoother follow (Lerp - alternative)
      // this.camera.scrollX = Phaser.Math.Linear(this.camera.scrollX, targetX - this.camera.width / 2, this.config.followLerp);
      // this.camera.scrollY = Phaser.Math.Linear(this.camera.scrollY, targetY - this.camera.height / 2, this.config.followLerp);
    }

    // Add any other camera effects or updates here
  }

  public override init(): void {
    Logger.debug(LOGGER_SOURCE, "Camera Manager Initialized");
    // Any specific initialization needed
  }

  /**
   * Cleans up CameraManager resources.
   * @param isHMRDispose - True if called during HMR dispose.
   */
  public override cleanup(isHMRDispose: boolean): void {
    Logger.info(
      LOGGER_SOURCE,
      `Camera Manager cleanup called (HMR: ${isHMRDispose}).`
    );
    // Logic moved from original destroy method
    if (this.scene?.input) {
      this.scene.input.off("wheel", this.handleZoom, this);
      Logger.debug(LOGGER_SOURCE, "Removed 'wheel' event listener.");
    } else {
      Logger.debug(
        LOGGER_SOURCE,
        "Scene or input not available, skipping wheel listener removal."
      );
    }
    this.target = null;
    this.camera = null;
    this.scene = null; // Clear scene reference
    Logger.debug(LOGGER_SOURCE, "Camera Manager cleanup complete.");
  }

  /**
   * Destroys the CameraManager.
   */
  public override destroy(): void {
    Logger.info(LOGGER_SOURCE, "Destroying CameraManager...");
    this.cleanup(false); // Call full cleanup on destroy
    // BaseManager destroy is called implicitly if super.destroy() existed and was called,
    // but since it's empty in BaseManager, we just ensure our cleanup runs.
  }
}
