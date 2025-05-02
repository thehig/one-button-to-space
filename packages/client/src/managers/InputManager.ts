import Phaser from "phaser";
import { BaseManager } from "./BaseManager";
import { Logger } from "@one-button-to-space/shared";
import { DeviceOrientationManager } from "../utils/DeviceOrientationManager";
import { EngineManager } from "./EngineManager";

// Logger Source for this file
const LOGGER_SOURCE = "⌨️🖱️";

// Interface for the object that handles scene-specific input logic
export interface ISceneInputHandler {
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
  private scene: Phaser.Scene | null = null;
  private registeredKeys: KeyMap = {}; // Keep for isKeyDown checks
  private deviceOrientationManager: DeviceOrientationManager;
  private activeSceneInputHandler: ISceneInputHandler | null = null;
  private engineManager: EngineManager;

  // Internal state for continuous inputs
  private lastOrientationAngle: number | null = null;
  private isPinching: boolean = false;
  private pinchStartDistance: number = 0;

  constructor(engineManager: EngineManager) {
    super();
    this.engineManager = engineManager;
    this.deviceOrientationManager = new DeviceOrientationManager();
  }

  public async setup(): Promise<void> {
    Logger.info(LOGGER_SOURCE, "InputManager setup initialized.");
  }

  public async teardown(): Promise<void> {
    Logger.info(LOGGER_SOURCE, "Tearing down InputManager...");
    this.removeInputListeners();
    this.activeSceneInputHandler?.destroy();
    this.activeSceneInputHandler = null;
    this.deviceOrientationManager.stopListening();
    this.scene = null;
    this.registeredKeys = {};
    this.resetInternalStates();
    Logger.info(LOGGER_SOURCE, "InputManager teardown complete.");
  }

  public setSceneContext(scene: Phaser.Scene): void {
    if (this.scene === scene) return;

    this.removeInputListeners();

    this.scene = scene;
    Logger.info(
      LOGGER_SOURCE,
      "InputManager context set for scene:",
      scene.scene.key
    );

    this.setupInputListeners();

    if (this.scene?.sys.game.device.input.touch) {
      this.startOrientationListening();
    }
  }

  public setActiveSceneInputHandler(handler: ISceneInputHandler | null): void {
    if (this.activeSceneInputHandler === handler) return;

    if (this.activeSceneInputHandler) {
      Logger.debug(
        LOGGER_SOURCE,
        "Removing previous active scene input handler."
      );
      this.activeSceneInputHandler.destroy();
    }

    this.activeSceneInputHandler = handler;
    if (handler) {
      Logger.info(LOGGER_SOURCE, "Active scene input handler set.");
    } else {
      Logger.info(LOGGER_SOURCE, "Active scene input handler cleared.");
    }
    this.resetInternalStates();
  }

  private setupInputListeners(): void {
    if (!this.scene) return;
    Logger.debug(LOGGER_SOURCE, "Setting up input listeners...");

    this.scene.input.keyboard?.on("keydown", this.handleKeyDown, this);
    this.scene.input.keyboard?.on("keyup", this.handleKeyUp, this);

    if (this.scene.sys.game.device.input.touch) {
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
    }
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
  }

  private resetInternalStates(): void {
    this.isPinching = false;
    this.pinchStartDistance = 0;
    this.lastOrientationAngle = null;
  }

  private handleKeyDown(event: KeyboardEvent): void {
    if (!this.activeSceneInputHandler) return;
    const keyUpper = event.key.toUpperCase();
    this.activeSceneInputHandler.handleKeyDown(keyUpper);
  }

  private handleKeyUp(event: KeyboardEvent): void {
    if (!this.activeSceneInputHandler) return;
    const keyUpper = event.key.toUpperCase();
    this.activeSceneInputHandler.handleKeyUp(keyUpper);
  }

  private handlePointerDown(pointer: Phaser.Input.Pointer): void {
    if (!this.activeSceneInputHandler) return;

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
        this.activeSceneInputHandler.handlePointerDown(pointer);
        return;
      }
    }
    this.activeSceneInputHandler.handlePointerDown(pointer);
  }

  private handlePointerUp(pointer: Phaser.Input.Pointer): void {
    if (!this.activeSceneInputHandler) return;

    if (this.isPinching && this.scene?.sys.game.device.input.touch) {
      const p1 = this.scene?.input.pointer1;
      const p2 = this.scene?.input.pointer2;
      if (!p1?.isDown || !p2?.isDown) {
        Logger.trace(LOGGER_SOURCE, "Pinch ended.");
        this.isPinching = false;
        this.pinchStartDistance = 0;
        this.activeSceneInputHandler.handlePointerUp(pointer);
        return;
      }
    }

    this.activeSceneInputHandler.handlePointerUp(pointer);
  }

  private handlePointerMove(pointer: Phaser.Input.Pointer): void {
    if (!this.activeSceneInputHandler) return;

    if (this.isPinching && this.scene?.sys.game.device.input.touch) {
      const p1 = this.scene.input.pointer1;
      const p2 = this.scene.input.pointer2;

      if (p1.isDown && p2.isDown) {
        const currentDistance = Phaser.Math.Distance.Between(
          p1.x,
          p1.y,
          p2.x,
          p2.y
        );
        const distanceChange = currentDistance - this.pinchStartDistance;

        if (Math.abs(distanceChange) > 1) {
          Logger.trace(
            LOGGER_SOURCE,
            `Pinch update. Change: ${distanceChange.toFixed(
              1
            )}, Current: ${currentDistance.toFixed(1)}`
          );
          this.activeSceneInputHandler.handlePinchUpdate(
            distanceChange,
            currentDistance
          );
          this.pinchStartDistance = currentDistance;
          return;
        }
      }
    }

    this.activeSceneInputHandler.handlePointerMove(pointer);
  }

  public registerKeys(keyCodes: string[]): void {
    if (!this.scene || !this.scene.input.keyboard) {
      Logger.warn(
        LOGGER_SOURCE,
        "Cannot register keys, scene or keyboard plugin not ready."
      );
      return;
    }
    const keyboardPlugin = this.scene.input.keyboard;

    keyCodes.forEach((keyCode) => {
      const keyUpper = keyCode.toUpperCase();
      if (!this.registeredKeys[keyUpper]) {
        try {
          this.registeredKeys[keyUpper] = keyboardPlugin.addKey(keyUpper, true);
          Logger.trace(LOGGER_SOURCE, `Registered key: ${keyUpper}`);
        } catch (e) {
          Logger.error(LOGGER_SOURCE, `Failed to register key: ${keyUpper}`, e);
        }
      } else {
      }
    });
  }

  public isKeyDown(keyCode: string): boolean {
    const keyUpper = keyCode.toUpperCase();
    const keyObject = this.registeredKeys[keyUpper];
    return keyObject ? keyObject.isDown : false;
  }

  public startOrientationListening(): void {
    this.deviceOrientationManager.startListening();
  }

  public getRawOrientation(): {
    alpha: number | null;
    beta: number | null;
    gamma: number | null;
  } | null {
    return this.deviceOrientationManager.getRawOrientation();
  }

  public getOrientationTargetAngleRadians(): number | null {
    return this.deviceOrientationManager.getTargetAngleRadians();
  }

  public getKeysDown(): string[] {
    const keysDown: string[] = [];
    for (const keyCode in this.registeredKeys) {
      if (this.registeredKeys[keyCode].isDown) {
        keysDown.push(keyCode);
      }
    }
    return keysDown;
  }

  public update(delta: number): void {
    if (this.scene?.sys.game.device.input.touch) {
      const currentAngle = this.getOrientationTargetAngleRadians();

      if (currentAngle !== null && currentAngle !== this.lastOrientationAngle) {
        if (this.activeSceneInputHandler) {
          Logger.trace(
            LOGGER_SOURCE,
            `Orientation changed: ${this.lastOrientationAngle?.toFixed(
              2
            )} -> ${currentAngle.toFixed(2)}`
          );
          this.activeSceneInputHandler.handleOrientationChange(currentAngle);
          this.lastOrientationAngle = currentAngle;
        } else {
          this.lastOrientationAngle = currentAngle;
        }
      } else if (currentAngle === null && this.lastOrientationAngle !== null) {
        if (this.activeSceneInputHandler) {
          Logger.trace(LOGGER_SOURCE, "Orientation became unavailable.");
          this.activeSceneInputHandler.handleOrientationChange(null);
        }
        this.lastOrientationAngle = null;
      }
    }
  }
}
