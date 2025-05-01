import Phaser from "phaser";
import { NetworkManager } from "./NetworkManager";
import { InputManager } from "./InputManager";
import { CameraManager } from "./CameraManager";
import { Logger } from "@one-button-to-space/shared";
import type { PlayerInputMessage } from "@one-button-to-space/shared";
import type { GameScene } from "../core/scenes/GameScene"; // Use type import for scene reference
import { EntityManager } from "./EntityManager"; // Import EntityManager
import { Player } from "../entities/Player"; // Import Player type

// Logger Source for this file
const LOGGER_SOURCE = "🕹️👆"; // Gamepad + finger for scene-specific input

// Threshold for sending angle updates based on orientation
const ORIENTATION_ANGLE_DELTA_THRESHOLD = Phaser.Math.DegToRad(2.5); // Radians (e.g., 2.5 degrees)
const ANGLE_DELTA_THRESHOLD = 0.005; // Radians - only send if change exceeds this for KEYBOARD input

/**
 * Manages input processing specifically for the GameScene.
 * Reads input states from the global InputManager and sends
 * relevant commands via the NetworkManager.
 */
export class SceneInputManager {
  private scene: GameScene;
  private networkManager: NetworkManager;
  private inputManager: InputManager;
  private cameraManager: CameraManager;
  private entityManager: EntityManager; // Add EntityManager property

  // Input state tracking moved from GameScene
  private playerInputSequence: number = 0;
  private wasThrusting: boolean = false; // Tracks thrust state from ANY source
  private readonly rotationSpeed: number = Math.PI / 2; // Radians per second (adjust as needed) for keyboard
  private lastSentAngle: number | null = null; // Track last sent angle

  // Touch specific state moved from GameScene
  private touchActive: boolean = false; // Flag if touch controls are active
  private pinchStartDistance: number = 0;
  private isPinching: boolean = false;
  private currentPinchDistance: number = 0; // Added to store current distance for debug

  constructor(
    scene: GameScene,
    networkManager: NetworkManager,
    inputManager: InputManager,
    cameraManager: CameraManager,
    entityManager: EntityManager // Add EntityManager to constructor
  ) {
    this.scene = scene;
    this.networkManager = networkManager;
    this.inputManager = inputManager;
    this.cameraManager = cameraManager;
    this.entityManager = entityManager; // Store EntityManager
  }

  public initialize(): void {
    Logger.info(LOGGER_SOURCE, "Scene Input Manager Initializing");
    // Check for touch support and setup listeners
    if (this.scene.sys.game.device.input.touch) {
      this.touchActive = true;
      Logger.info(
        LOGGER_SOURCE,
        "Mobile device detected, setting up touch listeners."
      );
      // Explicitly enable listening for a second pointer if not already done by default system
      // Check if pointer2 exists, if not, add one. Relying on pointer1 existence for input system check.
      if (this.scene.input.pointer1 && !this.scene.input.pointer2) {
        this.scene.input.addPointer(1);
      }

      // Add tap listeners
      this.scene.input.on(
        Phaser.Input.Events.POINTER_DOWN,
        this.handleTapStart,
        this
      );
      this.scene.input.on(
        Phaser.Input.Events.POINTER_UP,
        this.handleTapEnd,
        this
      );
      // Add pinch listeners (using pointer move)
      this.scene.input.on(
        Phaser.Input.Events.POINTER_MOVE,
        this.handlePointerMove,
        this
      );

      // Attempt to start orientation listening (might need user interaction first)
      // GameScene will call inputManager.startOrientationListening() after a delay/interaction
      // No need to call it here directly.
    } else {
      Logger.info(
        LOGGER_SOURCE,
        "Non-mobile device detected, touch/orientation controls disabled."
      );
    }
  }

  public destroy(): void {
    Logger.info(LOGGER_SOURCE, "Scene Input Manager Destroying");
    // Remove listeners if they were added
    if (this.touchActive) {
      this.scene.input.off(
        Phaser.Input.Events.POINTER_DOWN,
        this.handleTapStart,
        this
      );
      this.scene.input.off(
        Phaser.Input.Events.POINTER_UP,
        this.handleTapEnd,
        this
      );
      this.scene.input.off(
        Phaser.Input.Events.POINTER_MOVE,
        this.handlePointerMove,
        this
      );
    }
    // Reset state variables? Optional, depends if instance is reused
    this.playerInputSequence = 0;
    this.wasThrusting = false;
    this.lastSentAngle = null;
    this.touchActive = false;
    this.pinchStartDistance = 0;
    this.isPinching = false;
    this.currentPinchDistance = 0;
  }

  // --- Moved from GameScene ---
  public processInput(delta: number): void {
    // Check if network is connected (InputManager existence checked by constructor indirectly)
    if (!this.networkManager.isConnected()) return;

    // --- Thrust Input (Keyboard - only if touch is NOT active) --- //
    if (!this.touchActive) {
      const isThrusting =
        this.inputManager.isKeyDown("W") || this.inputManager.isKeyDown("UP");

      if (isThrusting && !this.wasThrusting) {
        // Started thrusting
        this.playerInputSequence++;
        const inputMsg: PlayerInputMessage = {
          seq: this.playerInputSequence,
          input: "thrust_start",
        };
        this.networkManager.sendMessage("playerInput", inputMsg);
        Logger.trace(LOGGER_SOURCE, "Sent KB input: thrust_start", {
          seq: inputMsg.seq,
        });
        this.wasThrusting = true; // Set state
      } else if (!isThrusting && this.wasThrusting) {
        // Stopped thrusting
        this.playerInputSequence++;
        const inputMsg: PlayerInputMessage = {
          seq: this.playerInputSequence,
          input: "thrust_stop",
        };
        this.networkManager.sendMessage("playerInput", inputMsg);
        Logger.trace(LOGGER_SOURCE, "Sent KB input: thrust_stop", {
          seq: inputMsg.seq,
        });
        this.wasThrusting = false; // Set state
      }
      // Don't update this.wasThrusting here, let tap handlers manage it if touchActive
    } // End keyboard thrust check

    // --- Rotation Input --- //
    let targetAngle: number | null = null; // Initialize to null
    let usingKeyboardRotation = false;

    // --- Attempt Orientation Input ONLY if on mobile/touch device --- //
    if (this.touchActive) {
      // Check touchActive flag
      const rawOrientationAngle =
        this.inputManager.getTargetRocketAngleRadians();
      if (rawOrientationAngle !== null) {
        // Apply -90 degree offset
        targetAngle = Phaser.Math.Angle.Wrap(rawOrientationAngle - Math.PI / 2);
      }
    }

    // Fallback to keyboard if orientation is not available/active OR if not on touch device
    if (targetAngle === null) {
      const rotateLeft =
        this.inputManager.isKeyDown("A") || this.inputManager.isKeyDown("LEFT");
      const rotateRight =
        this.inputManager.isKeyDown("D") ||
        this.inputManager.isKeyDown("RIGHT");

      if (rotateLeft || rotateRight) {
        // Need player entity for rotation base
        const player = this.entityManager.getCurrentPlayer() as
          | Player
          | undefined;
        if (player) {
          // Only proceed if player exists
          usingKeyboardRotation = true;
          const rotationDelta = (this.rotationSpeed * delta) / 1000; // Convert delta ms to seconds
          // Start keyboard rotation from last SENT angle or current player rotation
          let keyboardTargetAngle = this.lastSentAngle ?? player.rotation; // Use player.rotation as fallback

          if (rotateLeft) {
            keyboardTargetAngle -= rotationDelta;
          }
          if (rotateRight) {
            keyboardTargetAngle += rotationDelta;
          }
          targetAngle = Phaser.Math.Angle.Wrap(keyboardTargetAngle);
        }
      }
    }

    // --- Send Angle Update if Changed Significantly --- //
    if (targetAngle !== null) {
      const angleDifference =
        this.lastSentAngle !== null
          ? Math.abs(
              Phaser.Math.Angle.ShortestBetween(this.lastSentAngle, targetAngle)
            )
          : Infinity; // Always send the first update

      // Use different thresholds for orientation vs keyboard
      const threshold = usingKeyboardRotation
        ? ANGLE_DELTA_THRESHOLD
        : ORIENTATION_ANGLE_DELTA_THRESHOLD;

      if (angleDifference >= threshold) {
        // Send angle update to server
        this.playerInputSequence++;
        const inputMsg: PlayerInputMessage = {
          seq: this.playerInputSequence,
          input: "set_angle",
          value: targetAngle,
        };
        this.networkManager.sendMessage("playerInput", inputMsg);
        this.lastSentAngle = targetAngle; // Update last sent angle
        Logger.trace(
          LOGGER_SOURCE,
          `Sent input: set_angle (${targetAngle.toFixed(
            2
          )}), Diff: ${angleDifference.toFixed(3)}, Thresh: ${threshold.toFixed(
            3
          )}, Source: ${usingKeyboardRotation ? "Keyboard" : "Orientation"}`,
          { seq: inputMsg.seq }
        );
      }
    } // End if targetAngle !== null

    // --- Pinch Update (only if touch is active) --- //
    if (this.touchActive) {
      this.currentPinchDistance = this.updatePinchZoom(); // Store result for debug
    }

    // --- Action Input (Example - Not implemented for server yet) --- //
    // Remains commented out
  }

  // --- Moved from GameScene ---
  private handleTapStart(pointer: Phaser.Input.Pointer): void {
    Logger.debug(
      LOGGER_SOURCE,
      `handleTapStart triggered by pointer ID: ${pointer.id}`
    );
    // Only handle primary touch for thrust to avoid multi-touch issues
    if (
      !this.touchActive ||
      !pointer.isDown ||
      this.scene.input.pointer1 !== pointer
    )
      return;

    // Ignore if pinching
    if (this.isPinching || this.scene.input.pointer2?.isDown) {
      // Check pointer2 safely
      Logger.debug(
        LOGGER_SOURCE,
        "handleTapStart ignored: Pinching or second pointer active."
      );
      return;
    }

    // Send thrust start if not already thrusting
    if (!this.wasThrusting) {
      this.playerInputSequence++;
      const inputMsg: PlayerInputMessage = {
        seq: this.playerInputSequence,
        input: "thrust_start",
      };
      this.networkManager.sendMessage("playerInput", inputMsg);
      Logger.trace(LOGGER_SOURCE, "Sent touch input: thrust_start", {
        seq: inputMsg.seq,
      });
      this.wasThrusting = true;
    }
  }

  // --- Moved from GameScene ---
  private handleTapEnd(pointer: Phaser.Input.Pointer): void {
    Logger.debug(
      LOGGER_SOURCE,
      `handleTapEnd triggered by pointer ID: ${pointer.id}`
    );
    // Only handle primary touch for thrust
    if (!this.touchActive || this.scene.input.pointer1 !== pointer) return;

    // Reset pinch state if primary pointer goes up
    if (this.isPinching) {
      this.isPinching = false;
      this.pinchStartDistance = 0;
    }

    // Send thrust stop if thrusting
    if (this.wasThrusting) {
      this.playerInputSequence++;
      const inputMsg: PlayerInputMessage = {
        seq: this.playerInputSequence,
        input: "thrust_stop",
      };
      this.networkManager.sendMessage("playerInput", inputMsg);
      Logger.trace(LOGGER_SOURCE, "Sent touch input: thrust_stop", {
        seq: inputMsg.seq,
      });
      this.wasThrusting = false;
    }
  }

  // --- Moved from GameScene ---
  private handlePointerMove(pointer: Phaser.Input.Pointer): void {
    // Logger.debug(LOGGER_SOURCE, `handlePointerMove triggered by pointer ID: ${pointer.id}`); // Can be very spammy
    if (!this.touchActive) return;

    const p1 = this.scene.input.pointer1;
    const p2 = this.scene.input.pointer2;

    // Check if starting a pinch (both pointers down, not already pinching)
    // Safely check p2 existence
    if (p1.isDown && p2?.isDown && !this.isPinching) {
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
      // If tap was active, stop thrusting when pinch starts
      if (this.wasThrusting) {
        this.handleTapEnd(p1); // Treat as if primary finger lifted for thrust
      }
    }
  }

  // --- Moved from GameScene ---
  private updatePinchZoom(): number {
    // Logger.debug(LOGGER_SOURCE, `updatePinchZoom called. isPinching: ${this.isPinching}`); // Potentially spammy
    const p1 = this.scene.input.pointer1;
    const p2 = this.scene.input.pointer2;
    let currentDistance = 0;

    if (this.isPinching) {
      // If one pointer lifts, or p2 doesn't exist, stop pinching
      if (!p1.isDown || !p2?.isDown) {
        this.isPinching = false;
        this.pinchStartDistance = 0;
        Logger.trace(
          LOGGER_SOURCE,
          "Pinch ended (one pointer up or p2 missing)."
        );
        return 0; // Return 0 distance when pinch ends
      }

      currentDistance = Phaser.Math.Distance.Between(p1.x, p1.y, p2.x, p2.y);
      const distanceChange = currentDistance - this.pinchStartDistance;

      // Apply zoom based on distance change (adjust sensitivity as needed)
      // Check for a minimum change to avoid jitter
      if (Math.abs(distanceChange) > 5) {
        // Adjust threshold (5 pixels)
        Logger.debug(
          LOGGER_SOURCE,
          `Pinch detected: DistChange=${distanceChange.toFixed(1)}`
        );
        const zoomFactor = distanceChange * 0.005; // Adjust sensitivity (0.005)
        const currentZoom = this.cameraManager.currentZoom;
        let targetZoom = currentZoom + zoomFactor;

        // Clamp zoom
        targetZoom = Phaser.Math.Clamp(
          targetZoom,
          this.cameraManager.getMinZoom(),
          this.cameraManager.getMaxZoom()
        );

        if (Math.abs(targetZoom - currentZoom) > 0.01) {
          // Check significant change
          this.cameraManager.zoomTo(targetZoom, 50); // Apply smooth zoom
          // Logger.trace(LOGGER_SOURCE, `Pinch Zoom: Target=${targetZoom.toFixed(2)}, Factor=${zoomFactor.toFixed(3)}`);
        }
        // Update start distance for continuous pinch
        this.pinchStartDistance = currentDistance;
      }
    }
    return currentDistance; // Return current distance
  }

  // --- Getter for debug state ---
  public getDebugState(): {
    isPinching: boolean;
    pinchDistance: number;
    isThrusting: boolean;
    touchActive: boolean;
  } {
    return {
      isPinching: this.isPinching,
      pinchDistance: this.currentPinchDistance, // Use stored value
      isThrusting: this.wasThrusting,
      touchActive: this.touchActive,
    };
  }
}
