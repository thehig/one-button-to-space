import Phaser from "phaser";
import { NetworkManager } from "../../../managers/NetworkManager";
import { CameraManager } from "../../../managers/CameraManager";
import { Logger } from "@one-button-to-space/shared";
import type { PlayerInputMessage } from "@one-button-to-space/shared";
import type { GameScene } from "./index";
import { EntityManager } from "../../../managers/EntityManager";
import { Player } from "../../../entities/Player";
import {
  desktopKeybindings,
  DesktopKeybindings,
  DesktopAction,
} from "../../../config/desktopKeybindings"; // Import bindings

// Logger Source for this file
const LOGGER_SOURCE = "🕹️👆";

/**
 * Handles input processing specific to the GameScene.
 * Receives RAW input events from the global InputManager and interprets them
 * based on device type (touch/desktop) and desktop keybindings.
 */
export class SceneInputs {
  private scene: GameScene;
  private networkManager: NetworkManager;
  private cameraManager: CameraManager;
  private entityManager: EntityManager;
  private desktopKeybindings: DesktopKeybindings = desktopKeybindings; // Store bindings

  // Input state tracking
  private playerInputSequence: number = 0;
  private wasThrusting: boolean = false; // Tracks logical thrust state
  private isKeyboardTurningLeft: boolean = false;
  private isKeyboardTurningRight: boolean = false;
  private lastSentAngle: number | null = null; // Track last SENT angle (from device orientation)
  private isPinching: boolean = false; // Local tracking from pinch updates

  constructor(
    scene: GameScene,
    networkManager: NetworkManager,
    cameraManager: CameraManager,
    entityManager: EntityManager
  ) {
    this.scene = scene;
    this.networkManager = networkManager;
    this.cameraManager = cameraManager;
    this.entityManager = entityManager;
  }

  public initialize(): void {
    Logger.info(LOGGER_SOURCE, "SceneInputs Initializing");
    // No listener setup here
    // Request keys needed for desktop from InputManager
    if (!this.scene.sys.game.device.input.touch) {
      const keysToRegister = Object.values(this.desktopKeybindings).flat();
      // InputManager.getInstance().registerKeys(keysToRegister); // Access global instance
      // Assuming GameScene passes InputManager instance if needed, or use singleton access
      // For now, we rely on InputManager registering all keys in its own setup
      Logger.debug(
        LOGGER_SOURCE,
        "Desktop mode, relying on InputManager having registered keys:",
        keysToRegister
      );
    }
  }

  public destroy(): void {
    Logger.info(LOGGER_SOURCE, "SceneInputs Destroying");
    this.playerInputSequence = 0;
    this.wasThrusting = false;
    this.isKeyboardTurningLeft = false;
    this.isKeyboardTurningRight = false;
    this.lastSentAngle = null;
    this.isPinching = false;
  }

  // --- Raw Input Event Handlers --- //

  public handleKeyDown(keyCode: string): void {
    // Ignore if touch is active (desktop only)
    if (this.scene.sys.game.device.input.touch) return;

    // Logger.trace(LOGGER_SOURCE, `handleKeyDown received: ${keyCode}`);
    for (const action in this.desktopKeybindings) {
      if (this.desktopKeybindings[action as DesktopAction].includes(keyCode)) {
        switch (action as DesktopAction) {
          case "thrust":
            this.startThrust();
            break;
          case "turnLeft":
            if (!this.isKeyboardTurningLeft) {
              this.sendTurnStart("left");
              this.isKeyboardTurningLeft = true;
            }
            break;
          case "turnRight":
            if (!this.isKeyboardTurningRight) {
              this.sendTurnStart("right");
              this.isKeyboardTurningRight = true;
            }
            break;
          case "menu":
            this.triggerMenu();
            break;
        }
        return; // Found action
      }
    }
  }

  public handleKeyUp(keyCode: string): void {
    // Ignore if touch is active (desktop only)
    if (this.scene.sys.game.device.input.touch) return;

    // Logger.trace(LOGGER_SOURCE, `handleKeyUp received: ${keyCode}`);
    for (const action in this.desktopKeybindings) {
      if (this.desktopKeybindings[action as DesktopAction].includes(keyCode)) {
        switch (action as DesktopAction) {
          case "thrust":
            this.stopThrust();
            break;
          case "turnLeft":
            if (this.isKeyboardTurningLeft) {
              this.sendTurnStop("left");
              this.isKeyboardTurningLeft = false;
            }
            break;
          case "turnRight":
            if (this.isKeyboardTurningRight) {
              this.sendTurnStop("right");
              this.isKeyboardTurningRight = false;
            }
            break;
        }
        return; // Found action
      }
    }
  }

  public handlePointerDown(pointer: Phaser.Input.Pointer): void {
    // Ignore if not touch device or if it's not the primary pointer
    if (!this.scene.sys.game.device.input.touch || pointer.id !== 1) return;

    // InputManager handles pinch start detection, but we react to pointer down
    // if NOT pinching
    if (!this.isPinching) {
      this.startThrust();
    }
  }

  public handlePointerUp(pointer: Phaser.Input.Pointer): void {
    // Ignore if not touch device or if it's not the primary pointer
    if (!this.scene.sys.game.device.input.touch || pointer.id !== 1) return;

    // InputManager handles pinch end detection
    // We stop thrust only if we weren't pinching (pinch ending handles thrust stop)
    if (!this.isPinching) {
      this.stopThrust();
    }
    // Reset local pinch state on primary pointer up, just in case
    this.isPinching = false;
  }

  public handlePointerMove(pointer: Phaser.Input.Pointer): void {
    // Placeholder for potential drag interactions
    _pointer = pointer; // Suppress unused warning
  }

  public handleOrientationChange(angleRad: number | null): void {
    // Only handle orientation if touch is supported and angle is valid
    if (!this.scene.sys.game.device.input.touch || angleRad === null) return;

    // Directly use the processed angle from InputManager (already includes offset)
    this.sendAngleUpdate(angleRad);
  }

  public handlePinchUpdate(
    distanceChange: number,
    currentDistance: number
  ): void {
    // Set local pinch state - InputManager ensures this only fires during a pinch
    this.isPinching = true;

    // Apply zoom based on distance change
    const zoomFactor = distanceChange * 0.005; // Adjust sensitivity
    const currentZoom = this.cameraManager.currentZoom;
    let targetZoom = currentZoom + zoomFactor;
    targetZoom = Phaser.Math.Clamp(
      targetZoom,
      this.cameraManager.getMinZoom(),
      this.cameraManager.getMaxZoom()
    );

    if (Math.abs(targetZoom - currentZoom) > 0.01) {
      this.cameraManager.zoomTo(targetZoom, 50);
      // Logger.trace(LOGGER_SOURCE, `Pinch Zoom Applied: Target=${targetZoom.toFixed(2)}`);
    }
    _currentDistance = currentDistance; // Suppress warning
  }

  // --- Internal Logic --- //

  private startThrust(): void {
    // Check local pinch state
    if (this.isPinching) {
      Logger.trace(LOGGER_SOURCE, "startThrust ignored: Pinching active.");
      return;
    }
    if (!this.wasThrusting) {
      this.playerInputSequence++;
      const inputMsg: PlayerInputMessage = {
        seq: this.playerInputSequence,
        input: "thrust_start",
      };
      this.networkManager.sendMessage("player_input", inputMsg);
      Logger.trace(LOGGER_SOURCE, "Sent logical input: thrust_start", {
        seq: inputMsg.seq,
      });
      this.wasThrusting = true;
    }
  }

  private stopThrust(): void {
    if (this.wasThrusting) {
      this.playerInputSequence++;
      const inputMsg: PlayerInputMessage = {
        seq: this.playerInputSequence,
        input: "thrust_stop",
      };
      this.networkManager.sendMessage("player_input", inputMsg);
      Logger.trace(LOGGER_SOURCE, "Sent logical input: thrust_stop", {
        seq: inputMsg.seq,
      });
      this.wasThrusting = false;
    }
    // Reset pinch state when thrust stops (e.g., finger lifted)
    this.isPinching = false;
  }

  private sendAngleUpdate(targetAngle: number): void {
    const ANGLE_SEND_THRESHOLD = 0.005; // Radians - minimum change to send
    const angleDifference =
      this.lastSentAngle !== null
        ? Math.abs(
            Phaser.Math.Angle.ShortestBetween(this.lastSentAngle, targetAngle)
          )
        : Infinity;

    if (angleDifference >= ANGLE_SEND_THRESHOLD) {
      this.playerInputSequence++;
      const inputMsg: PlayerInputMessage = {
        seq: this.playerInputSequence,
        input: "set_angle",
        value: targetAngle,
      };
      this.networkManager.sendMessage("player_input", inputMsg);
      this.lastSentAngle = targetAngle;
      Logger.trace(
        LOGGER_SOURCE,
        `Sent logical input: set_angle (${targetAngle.toFixed(
          2
        )}), Diff: ${angleDifference.toFixed(3)}`,
        { seq: inputMsg.seq }
      );
    }
  }

  private triggerMenu(): void {
    Logger.info(
      LOGGER_SOURCE,
      "Logical input: menu_open - Triggering Pause/Menu"
    );
    // TODO: Implement menu toggling logic
  }

  private sendTurnStart(direction: "left" | "right"): void {
    this.playerInputSequence++;
    const input: PlayerInputMessage["input"] =
      direction === "left" ? "turn_left_start" : "turn_right_start";
    const inputMsg: PlayerInputMessage = {
      seq: this.playerInputSequence,
      input: input,
    };
    this.networkManager.sendMessage("player_input", inputMsg);
    Logger.trace(LOGGER_SOURCE, `Sent logical input: ${input}`, {
      seq: inputMsg.seq,
    });
  }

  private sendTurnStop(direction: "left" | "right"): void {
    this.playerInputSequence++;
    const input: PlayerInputMessage["input"] =
      direction === "left" ? "turn_left_stop" : "turn_right_stop";
    const inputMsg: PlayerInputMessage = {
      seq: this.playerInputSequence,
      input: input,
    };
    this.networkManager.sendMessage("player_input", inputMsg);
    Logger.trace(LOGGER_SOURCE, `Sent logical input: ${input}`, {
      seq: inputMsg.seq,
    });
  }

  /** Update method for continuous actions */
  public update(delta: number): void {
    // Ignore if touch is active (desktop only)
    if (this.scene.sys.game.device.input.touch) return;

    _delta = delta; // Suppress unused warning if nothing else uses it
  }

  // --- Getter for debug state --- //
  public getDebugState(): {
    isPinching: boolean;
    isThrusting: boolean;
    isKeyboardTurningLeft: boolean;
    isKeyboardTurningRight: boolean;
  } {
    return {
      isPinching: this.isPinching,
      isThrusting: this.wasThrusting,
      isKeyboardTurningLeft: this.isKeyboardTurningLeft,
      isKeyboardTurningRight: this.isKeyboardTurningRight,
    };
  }
}

// Helpers to suppress unused variable warnings
// eslint-disable-next-line @typescript-eslint/no-unused-vars
let _pointer: Phaser.Input.Pointer;
// eslint-disable-next-line @typescript-eslint/no-unused-vars
let _currentDistance: number;
// eslint-disable-next-line @typescript-eslint/no-unused-vars
let _delta: number;
