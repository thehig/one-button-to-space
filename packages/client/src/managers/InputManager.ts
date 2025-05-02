import Phaser from "phaser";
import { BaseManager } from "./BaseManager";
import { Logger } from "@one-button-to-space/shared";
import { DeviceOrientationManager } from "../utils/DeviceOrientationManager";

// Logger Source for this file
const LOGGER_SOURCE = "⌨️🖱️";

// Interface for the object that handles scene-specific input logic
interface ISceneInputHandler {
  // Raw physical input handlers
  handleKeyDown(keyCode: string): void;
  handleKeyUp(keyCode: string): void;
  handlePointerDown(pointer: Phaser.Input.Pointer): void;
  handlePointerUp(pointer: Phaser.Input.Pointer): void;
  handlePointerMove(pointer: Phaser.Input.Pointer): void;
  handleOrientationChange(angleRad: number | null): void; // Processed orientation angle (or null)
  handlePinchUpdate(distanceChange: number, currentDistance: number): void;
  destroy: () => void;
}

interface KeyMap {
  [key: string]: Phaser.Input.Keyboard.Key;
}

/**
 * Handles GLOBAL physical input detection (keyboard, touch, orientation)
 * and delegates raw events to the active scene's input handler.
 */
export class InputManager extends BaseManager {
  public static instance: InputManager;
  private scene: Phaser.Scene | null = null;
  private registeredKeys: KeyMap = {}; // Keep for isKeyDown checks
  private deviceOrientationManager: DeviceOrientationManager;
  private activeSceneInputHandler: ISceneInputHandler | null = null;

  // Internal state for continuous inputs
  private lastOrientationAngle: number | null = null;
  private isPinching: boolean = false;
  private pinchStartDistance: number = 0;

  private constructor() {
    super();
    this.deviceOrientationManager = new DeviceOrientationManager();
  }

  public static getInstance(): InputManager {
    if (!InputManager.instance) {
      InputManager.instance = new InputManager();
    }
    return InputManager.instance;
  }

  /**
   * Resets the singleton instance, ensuring a fresh start.
   * Should be called during cleanup processes like HMR.
   */
  public static resetInstance(): void {
    if (InputManager.instance) {
      Logger.debug(LOGGER_SOURCE, "Resetting InputManager instance.");
      InputManager.instance.destroy(); // Call the instance's destroy method
      InputManager.instance = null!; // Explicitly nullify the static instance
    } else {
      Logger.trace(
        LOGGER_SOURCE,
        "InputManager instance already null, skipping reset."
      );
    }
  }

  // Set the active scene context AND setup listeners
  public setSceneContext(scene: Phaser.Scene): void {
    if (this.scene === scene) return; // Avoid redundant setup

    // Clean up listeners from previous scene if any
    this.removeInputListeners();

    this.scene = scene;
    Logger.info(
      LOGGER_SOURCE,
      "InputManager context set for scene:",
      scene.scene.key
    );

    // Setup listeners for the new scene
    this.setupInputListeners();

    // Attempt to start orientation listening immediately if touch is supported
    if (this.scene?.sys.game.device.input.touch) {
      this.startOrientationListening();
    }
  }

  // Method for scenes to register their specific input handler
  public setActiveSceneInputHandler(handler: ISceneInputHandler | null): void {
    if (this.activeSceneInputHandler === handler) return;

    if (this.activeSceneInputHandler) {
      Logger.debug(
        LOGGER_SOURCE,
        "Removing previous active scene input handler."
      );
      // Potentially call a cleanup method on the old handler if needed
    }

    this.activeSceneInputHandler = handler;
    if (handler) {
      Logger.info(LOGGER_SOURCE, "Active scene input handler set.");
    } else {
      Logger.info(LOGGER_SOURCE, "Active scene input handler cleared.");
    }
    // Reset internal input states when handler changes
    this.resetInternalStates();
  }

  private setupInputListeners(): void {
    if (!this.scene) return;
    Logger.debug(LOGGER_SOURCE, "Setting up input listeners...");

    // Keyboard Listeners (using scene events for keydown/keyup)
    this.scene.input.keyboard?.on("keydown", this.handleKeyDown, this);
    this.scene.input.keyboard?.on("keyup", this.handleKeyUp, this);

    // Pointer Listeners (Tap, Pinch)
    if (this.scene.sys.game.device.input.touch) {
      // Ensure second pointer is available if needed
      if (this.scene.input.pointer1 && !this.scene.input.pointer2) {
        this.scene.input.addPointer(1);
      }
      this.scene.input.on(
        Phaser.Input.Events.POINTER_DOWN,
        this.handlePointerDown,
        this
      );
      this.scene.input.on(
        Phaser.Input.Events.POINTER_UP,
        this.handlePointerUp,
        this
      );
      this.scene.input.on(
        Phaser.Input.Events.POINTER_MOVE,
        this.handlePointerMove,
        this
      );
    } else {
      // Basic mouse click listener for non-touch (can be mapped to THRUST)
      this.scene.input.on(
        Phaser.Input.Events.POINTER_DOWN,
        this.handlePointerDown, // Use same handler for simplicity
        this
      );
      this.scene.input.on(
        Phaser.Input.Events.POINTER_UP,
        this.handlePointerUp, // Use same handler for simplicity
        this
      );
    }

    // Orientation Listener (managed by DeviceOrientationManager)
    // No direct listener here, we poll it in the update loop or when needed
  }

  private removeInputListeners(): void {
    if (!this.scene) return;
    Logger.debug(LOGGER_SOURCE, "Removing input listeners...");

    this.scene.input.keyboard?.off("keydown", this.handleKeyDown, this);
    this.scene.input.keyboard?.off("keyup", this.handleKeyUp, this);

    this.scene.input.off(
      Phaser.Input.Events.POINTER_DOWN,
      this.handlePointerDown,
      this
    );
    this.scene.input.off(
      Phaser.Input.Events.POINTER_UP,
      this.handlePointerUp,
      this
    );
    this.scene.input.off(
      Phaser.Input.Events.POINTER_MOVE,
      this.handlePointerMove,
      this
    );
    // No need to remove orientation listener as it's managed internally
  }

  private resetInternalStates(): void {
    this.isPinching = false;
    this.pinchStartDistance = 0;
    this.lastOrientationAngle = null;
    // Don't reset registeredKeys here, they might persist across handlers
  }

  // --- Listener Handlers --- //

  private handleKeyDown(event: KeyboardEvent): void {
    if (!this.activeSceneInputHandler) return;
    const keyUpper = event.key.toUpperCase();
    // Simply forward the key code
    this.activeSceneInputHandler.handleKeyDown(keyUpper);
  }

  private handleKeyUp(event: KeyboardEvent): void {
    if (!this.activeSceneInputHandler) return;
    const keyUpper = event.key.toUpperCase();
    // Simply forward the key code
    this.activeSceneInputHandler.handleKeyUp(keyUpper);
  }

  private handlePointerDown(pointer: Phaser.Input.Pointer): void {
    if (!this.activeSceneInputHandler) return;

    // Pinch Start Detection (remains here as InputManager owns pinch state)
    if (this.scene?.sys.game.device.input.touch) {
      const p1 = this.scene?.input.pointer1;
      const p2 = this.scene?.input.pointer2;
      if (p1?.isDown && p2?.isDown && !this.isPinching) {
        this.isPinching = true;
        this.pinchStartDistance = Phaser.Math.Distance.Between(
          p1.x,
          p1.y,
          p2.x,
          p2.y
        );
        Logger.trace(
          LOGGER_SOURCE,
          `Pinch started. Dist: ${this.pinchStartDistance.toFixed(1)}`
        );
        // Forward the pointer event *after* setting pinch state
        this.activeSceneInputHandler.handlePointerDown(pointer);
        return; // Stop processing if pinch started
      }
    }
    // Forward the raw pointer event
    this.activeSceneInputHandler.handlePointerDown(pointer);
  }

  private handlePointerUp(pointer: Phaser.Input.Pointer): void {
    if (!this.activeSceneInputHandler) return;

    // Pinch End Detection (remains here)
    if (this.isPinching && this.scene?.sys.game.device.input.touch) {
      const p1 = this.scene?.input.pointer1;
      const p2 = this.scene?.input.pointer2;
      if (!p1?.isDown || !p2?.isDown) {
        Logger.trace(LOGGER_SOURCE, "Pinch ended.");
        this.isPinching = false;
        this.pinchStartDistance = 0;
      }
    }
    // Forward the raw pointer event
    this.activeSceneInputHandler.handlePointerUp(pointer);
  }

  private handlePointerMove(pointer: Phaser.Input.Pointer): void {
    if (
      !this.activeSceneInputHandler ||
      !this.scene?.sys.game.device.input.touch
    )
      return;

    // Allow scene handler to react to general pointer movement if needed
    this.activeSceneInputHandler.handlePointerMove(pointer);

    // Pinch Update Logic
    if (this.isPinching) {
      const p1 = this.scene?.input.pointer1;
      const p2 = this.scene?.input.pointer2;

      if (!p1?.isDown || !p2?.isDown) {
        if (this.isPinching) {
          Logger.warn(LOGGER_SOURCE, "Pinch ended unexpectedly during move.");
          this.isPinching = false;
          this.pinchStartDistance = 0;
        }
        return;
      }

      const currentDistance = Phaser.Math.Distance.Between(
        p1.x,
        p1.y,
        p2.x,
        p2.y
      );
      const distanceChange = currentDistance - this.pinchStartDistance;

      if (Math.abs(distanceChange) > 1) {
        this.activeSceneInputHandler.handlePinchUpdate(
          distanceChange,
          currentDistance
        );
        this.pinchStartDistance = currentDistance;
      }
    }
  }

  // --- Public Methods --- //

  /**
   * Registers specific keys for tracking.
   * @param keyCodes - An array of key codes.
   */
  public registerKeys(keyCodes: string[]): void {
    if (!this.scene?.input?.keyboard) {
      Logger.error(
        LOGGER_SOURCE,
        "Cannot register keys: Keyboard plugin not available."
      );
      return;
    }
    keyCodes.forEach((keyCode) => {
      const keyUpper = keyCode.toUpperCase(); // Standardize
      if (!this.registeredKeys[keyUpper]) {
        try {
          this.registeredKeys[keyUpper] = this.scene!.input.keyboard!.addKey(
            keyUpper,
            true // enableCapture set to true
          );
          Logger.trace(LOGGER_SOURCE, `Registered key: ${keyUpper}`);
        } catch (error) {
          Logger.error(
            LOGGER_SOURCE,
            `Failed to register key: ${keyUpper}`,
            error
          );
        }
      }
    });
  }

  /**
   * Checks if a specific registered key is currently held down.
   * @param keyCode - The key code string (e.g., 'W', 'A').
   * @returns True if the key is down, false otherwise.
   */
  public isKeyDown(keyCode: string): boolean {
    const keyUpper = keyCode.toUpperCase(); // Standardize
    const key = this.registeredKeys[keyUpper];
    return key ? key.isDown : false;
  }

  /** Starts listening for device orientation changes. */
  public startOrientationListening(): void {
    Logger.debug(LOGGER_SOURCE, "Attempting to start orientation listening...");
    this.deviceOrientationManager.startListening();
  }

  /** Gets the raw device orientation data. */
  public getRawOrientation(): {
    // Keep for debug
    alpha: number | null;
    beta: number | null;
    gamma: number | null;
  } | null {
    return {
      alpha: this.deviceOrientationManager.alpha,
      beta: this.deviceOrientationManager.beta,
      gamma: this.deviceOrientationManager.gamma,
    };
  }

  /** Gets the calculated target angle based on device orientation. */
  public getOrientationTargetAngleRadians(): number | null {
    // Renamed for clarity
    return this.deviceOrientationManager.getTargetRocketAngleRadians();
  }

  /** Gets the list of currently pressed registered keys. */
  public getKeysDown(): string[] {
    // Keep for debug
    return Object.keys(this.registeredKeys).filter((code) =>
      this.isKeyDown(code)
    );
  }

  /** Update loop for continuous inputs like orientation */
  public update(delta: number): void {
    if (!this.activeSceneInputHandler || !this.scene) return;

    let finalOrientationAngle: number | null = null;

    // --- Orientation Handling --- //
    // Calculate angle regardless of touch support, but handler can ignore it
    const currentAngleRad = this.getOrientationTargetAngleRadians();
    if (currentAngleRad !== null) {
      // Apply offset
      finalOrientationAngle = Phaser.Math.Angle.Wrap(
        currentAngleRad - Math.PI / 2
      );
    }

    // Always notify handler of the current orientation state (even if null)
    // Only notify if changed significantly from last notification
    const angleDifference =
      this.lastOrientationAngle !== null && finalOrientationAngle !== null
        ? Math.abs(
            Phaser.Math.Angle.ShortestBetween(
              this.lastOrientationAngle,
              finalOrientationAngle
            )
          )
        : this.lastOrientationAngle === null && finalOrientationAngle === null
        ? 0
        : Infinity; // Changed if one is null and other isn't

    const ORIENTATION_NOTIFY_THRESHOLD = Phaser.Math.DegToRad(1.0);
    if (angleDifference >= ORIENTATION_NOTIFY_THRESHOLD) {
      // Logger.trace(LOGGER_SOURCE, `Notifying handler of orientation change: ${finalOrientationAngle?.toFixed(3)} rad`);
      this.activeSceneInputHandler.handleOrientationChange(
        finalOrientationAngle
      );
      this.lastOrientationAngle = finalOrientationAngle;
    }

    // --- Keyboard Rotation REMOVED --- Scene handler is responsible based on key events

    // Delta is unused here now, but keep param in case needed later
    _delta = delta; // Suppress unused variable warning if necessary
  }

  public override init(): void {
    Logger.info(LOGGER_SOURCE, "Input Manager Initialized");
    // Setup listeners should happen in setSceneContext
  }

  public override async destroy(): Promise<void> {
    Logger.info(LOGGER_SOURCE, "Input Manager Destroying");
    this.removeInputListeners(); // Clean up listeners
    this.deviceOrientationManager.destroy();
    // Clean up registered keys
    Logger.debug(LOGGER_SOURCE, "Destroying registered Phaser key objects...");
    Object.values(this.registeredKeys).forEach((key) => {
      try {
        key.destroy();
      } catch (error) {
        Logger.warn(LOGGER_SOURCE, `Error destroying key object:`, error);
      }
    });
    this.registeredKeys = {};
    this.scene = null; // Clear scene reference
    this.activeSceneInputHandler = null; // Clear handler reference
    Logger.debug(LOGGER_SOURCE, "Input Manager cleanup complete.");
  }
}

// Helper to suppress unused variable warnings if needed
// eslint-disable-next-line @typescript-eslint/no-unused-vars
let _delta: number;
