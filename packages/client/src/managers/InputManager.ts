import Phaser from "phaser";
import { BaseManager } from "./BaseManager";
import { Logger } from "@one-button-to-space/shared";
import { DeviceOrientationManager } from "../utils/DeviceOrientationManager";

// Logger Source for this file
const LOGGER_SOURCE = "⌨️🖱️";

// Interface for the object that handles scene-specific input logic
interface ISceneInputHandler {
  handleThrustStart: () => void;
  handleThrustStop: () => void;
  handleSetAngle: (angle: number) => void;
  handlePinchUpdate: (distanceChange: number, currentDistance: number) => void; // Pass change and current distance
  handlePointerMove: (pointer: Phaser.Input.Pointer) => void; // Keep for potential drag/other interactions
  destroy: () => void; // Ensure handlers have a destroy method
}

interface KeyMap {
  [key: string]: Phaser.Input.Keyboard.Key;
}

/**
 * Handles GLOBAL physical input detection (keyboard, touch, orientation)
 * and delegates logical actions to the active scene's input handler.
 */
export class InputManager extends BaseManager {
  public static instance: InputManager;
  private scene: Phaser.Scene | null = null;
  private registeredKeys: KeyMap = {}; // Stores specific keys requested by scenes (could be deprecated)
  private deviceOrientationManager: DeviceOrientationManager;
  private activeSceneInputHandler: ISceneInputHandler | null = null;

  // Internal state for continuous inputs
  private lastOrientationAngle: number | null = null;
  private isPinching: boolean = false;
  private pinchStartDistance: number = 0;

  // Define standard key mappings (can be overridden by scene handlers later if needed)
  private keyMappings = {
    THRUST: ["W", "UP"],
    ROTATE_LEFT: ["A", "LEFT"],
    ROTATE_RIGHT: ["D", "RIGHT"],
    // ACTION_1: ["SPACE"],
  };

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

    // Automatically register standard keys
    this.registerStandardKeys();

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

    // Logger.trace(LOGGER_SOURCE, `KeyDown: ${event.key}`); // Can be spammy
    const keyUpper = event.key.toUpperCase();

    if (this.keyMappings.THRUST.includes(keyUpper)) {
      this.activeSceneInputHandler.handleThrustStart();
    }
    // Handle rotation start potentially (or handle in update loop based on isKeyDown)
    // if (this.keyMappings.ROTATE_LEFT.includes(keyUpper)) { ... }
    // if (this.keyMappings.ROTATE_RIGHT.includes(keyUpper)) { ... }
  }

  private handleKeyUp(event: KeyboardEvent): void {
    if (!this.activeSceneInputHandler) return;

    // Logger.trace(LOGGER_SOURCE, `KeyUp: ${event.key}`); // Can be spammy
    const keyUpper = event.key.toUpperCase();

    if (this.keyMappings.THRUST.includes(keyUpper)) {
      this.activeSceneInputHandler.handleThrustStop();
    }
    // Handle rotation stop potentially
    // if (this.keyMappings.ROTATE_LEFT.includes(keyUpper)) { ... }
    // if (this.keyMappings.ROTATE_RIGHT.includes(keyUpper)) { ... }
  }

  private handlePointerDown(pointer: Phaser.Input.Pointer): void {
    if (!this.activeSceneInputHandler) return;
    // Logger.debug(LOGGER_SOURCE, `PointerDown ID: ${pointer.id}`);

    const p1 = this.scene?.input.pointer1;
    const p2 = this.scene?.input.pointer2;

    // Pinch Start Detection
    // Check pointer2 safely
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
      // If starting a pinch, potentially stop thrust if it was active
      // This requires the scene handler to track its own thrust state
      // Maybe call a specific handlePinchStart method?
      this.activeSceneInputHandler.handleThrustStop(); // Stop thrust on pinch start
      return; // Don't process as tap if pinch starts
    }

    // Tap Start Detection (only primary pointer, not pinching)
    if (p1 === pointer && !this.isPinching) {
      // Logger.debug(LOGGER_SOURCE, "Primary pointer down, handling as thrust start.");
      this.activeSceneInputHandler.handleThrustStart();
    }
  }

  private handlePointerUp(pointer: Phaser.Input.Pointer): void {
    if (!this.activeSceneInputHandler) return;
    // Logger.debug(LOGGER_SOURCE, `PointerUp ID: ${pointer.id}`);

    const p1 = this.scene?.input.pointer1;
    const p2 = this.scene?.input.pointer2;

    // Pinch End Detection
    if (this.isPinching && (!p1?.isDown || !p2?.isDown)) {
      Logger.trace(LOGGER_SOURCE, "Pinch ended.");
      this.isPinching = false;
      this.pinchStartDistance = 0;
      // No specific action needed on handler for pinch end usually
    }

    // Tap End Detection (only primary pointer)
    if (p1 === pointer) {
      // Logger.debug(LOGGER_SOURCE, "Primary pointer up, handling as thrust stop.");
      // Only stop thrust if not pinching (pinch end handled above)
      if (!this.isPinching) {
        this.activeSceneInputHandler.handleThrustStop();
      }
    }
  }

  private handlePointerMove(pointer: Phaser.Input.Pointer): void {
    if (!this.activeSceneInputHandler) return;

    // Allow scene handler to react to general pointer movement if needed
    this.activeSceneInputHandler.handlePointerMove(pointer);

    // Pinch Update Logic
    if (this.isPinching) {
      const p1 = this.scene?.input.pointer1;
      const p2 = this.scene?.input.pointer2;

      if (!p1?.isDown || !p2?.isDown) {
        // Should have been caught by pointerup, but double-check
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

      // Delegate pinch update only if distance changed significantly
      if (Math.abs(distanceChange) > 1) {
        // Threshold reduced for smoother updates
        // Logger.trace(LOGGER_SOURCE, `Pinch Move Update: Change=${distanceChange.toFixed(1)}`);
        this.activeSceneInputHandler.handlePinchUpdate(
          distanceChange,
          currentDistance
        );
        // Update start distance for continuous pinch calculation within InputManager
        this.pinchStartDistance = currentDistance;
      }
    }
  }

  // --- Public Methods --- //

  /**
   * Registers specific keys for tracking. Should be less needed now.
   * @param keyCodes - An array of key codes (e.g., 'W', 'A', 'SPACE', 'LEFT').
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
            `Failed to register key: ${keyUpper}`, // Use standardized code
            error
          );
        }
      }
    });
  }

  /** Automatically registers keys defined in keyMappings */
  private registerStandardKeys(): void {
    const allKeys = Object.values(this.keyMappings).flat();
    this.registerKeys(allKeys);
    Logger.debug(LOGGER_SOURCE, "Registered standard keys:", allKeys);
  }

  /**
   * Checks if a specific registered key is currently held down.
   * Useful for continuous actions like rotation based on hold.
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

  /** Update loop for continuous inputs like orientation and keyboard rotation */
  public update(delta: number): void {
    if (!this.activeSceneInputHandler || !this.scene) return;

    let orientationAngleUsed = false; // Flag to track if orientation angle was processed

    // --- Orientation Handling (Only if touch is supported) --- //
    if (this.scene.sys.game.device.input.touch) {
      const currentAngleRad = this.getOrientationTargetAngleRadians(); // Get angle ONLY if touch supported
      if (currentAngleRad !== null) {
        orientationAngleUsed = true; // Mark that orientation provided an angle
        // Apply -90 degree offset for spaceship sprite
        const targetAngle = Phaser.Math.Angle.Wrap(
          currentAngleRad - Math.PI / 2
        );

        const angleDifference =
          this.lastOrientationAngle !== null
            ? Math.abs(
                Phaser.Math.Angle.ShortestBetween(
                  this.lastOrientationAngle,
                  targetAngle
                )
              )
            : Infinity;

        // Send update if angle changed significantly
        const ORIENTATION_THRESHOLD = Phaser.Math.DegToRad(1.5); // Smaller threshold for smoother updates
        if (angleDifference >= ORIENTATION_THRESHOLD) {
          // Logger.trace(LOGGER_SOURCE, `Orientation Update: Angle=${targetAngle.toFixed(2)}, Diff=${angleDifference.toFixed(3)}`);
          this.activeSceneInputHandler.handleSetAngle(targetAngle);
          this.lastOrientationAngle = targetAngle;
        }
      }
    }

    // --- Keyboard Rotation Handling (if not using orientation) --- //
    // Only handle keyboard rotation if orientation wasn't processed OR if not on touch device
    const canUseKeyboardRotation = !orientationAngleUsed; // Simplified condition

    if (canUseKeyboardRotation) {
      const rotateLeft = this.isKeyDown("A") || this.isKeyDown("LEFT");
      const rotateRight = this.isKeyDown("D") || this.isKeyDown("RIGHT");

      if (rotateLeft || rotateRight) {
        // Delegate angle calculation to the scene handler, as it might need player state
        // For now, we calculate and send directly, assuming scene handler can cope
        // This might need refinement if the handler *needs* to know the base rotation
        const rotationSpeed = Math.PI / 2; // Radians per second (could be configurable)
        const rotationDelta = (rotationSpeed * delta) / 1000;
        let angleChange = 0;
        if (rotateLeft) angleChange -= rotationDelta;
        if (rotateRight) angleChange += rotationDelta;

        // How to get the base angle? We'll use the last SENT angle from orientation OR 0
        // This is imperfect. SceneInputHandler should ideally manage its own angle
        const baseAngle = this.lastOrientationAngle ?? 0; // Imperfect fallback
        const targetAngle = Phaser.Math.Angle.Wrap(baseAngle + angleChange);

        // Send keyboard angle update (potentially less strict threshold?)
        this.activeSceneInputHandler.handleSetAngle(targetAngle);
        // We might want to update lastOrientationAngle here too, or have a separate lastKeyboardAngle
        this.lastOrientationAngle = targetAngle; // Update last sent angle regardless of source for now
        // Logger.trace(LOGGER_SOURCE, `Keyboard Rotation Update: Angle=${targetAngle.toFixed(2)}`);
      }
    }
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
