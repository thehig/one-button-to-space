import Phaser from "phaser";
import { NetworkManager } from "../../managers/NetworkManager";
import { CameraManager } from "../../managers/CameraManager";
import { Logger } from "@one-button-to-space/shared";
import type { PlayerInputMessage } from "@one-button-to-space/shared";
import type { GameScene } from "./index";
import { EntityManager } from "../../managers/EntityManager";
import { Player } from "../../entities/Player";

// Logger Source for this file
const LOGGER_SOURCE = "🕹️👆";

/**
 * Handles input processing specific to the GameScene.
 * Receives logical actions from the global InputManager and sends
 * relevant commands via the NetworkManager.
 */
export class SceneInputs {
  private scene: GameScene;
  private networkManager: NetworkManager;
  private cameraManager: CameraManager;
  private entityManager: EntityManager;

  // Input state tracking
  private playerInputSequence: number = 0;
  private wasThrusting: boolean = false; // Tracks logical thrust state
  private lastSentAngle: number | null = null; // Track last SENT angle

  // Touch specific state (isPinching might still be relevant locally)
  private isPinching: boolean = false; // Local tracking if needed

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
    // No listener setup here anymore, handled by InputManager
  }

  public destroy(): void {
    Logger.info(LOGGER_SOURCE, "SceneInputs Destroying");
    // No listener removal here
    // Reset internal state
    this.playerInputSequence = 0;
    this.wasThrusting = false;
    this.lastSentAngle = null;
    this.isPinching = false;
  }

  // --- Logical Action Handlers --- //

  public handleThrustStart(): void {
    // Ignore if pinching (InputManager might already prevent this, but double-check is safe)
    if (this.isPinching) {
      Logger.trace(
        LOGGER_SOURCE,
        "handleThrustStart ignored: Pinching active."
      );
      return;
    }
    // Send thrust start only if not already logically thrusting
    if (!this.wasThrusting) {
      this.playerInputSequence++;
      const inputMsg: PlayerInputMessage = {
        seq: this.playerInputSequence,
        input: "thrust_start",
      };
      this.networkManager.sendMessage("playerInput", inputMsg);
      Logger.trace(LOGGER_SOURCE, "Sent logical input: thrust_start", {
        seq: inputMsg.seq,
      });
      this.wasThrusting = true;
    }
  }

  public handleThrustStop(): void {
    // Send thrust stop only if logically thrusting
    if (this.wasThrusting) {
      this.playerInputSequence++;
      const inputMsg: PlayerInputMessage = {
        seq: this.playerInputSequence,
        input: "thrust_stop",
      };
      this.networkManager.sendMessage("playerInput", inputMsg);
      Logger.trace(LOGGER_SOURCE, "Sent logical input: thrust_stop", {
        seq: inputMsg.seq,
      });
      this.wasThrusting = false;
    }
    // Reset pinch state when thrust stops (e.g., finger lifted)
    // InputManager handles pinch start/end detection, but this ensures clean state
    this.isPinching = false;
  }

  public handleSetAngle(targetAngle: number): void {
    // Basic thresholding based on last *sent* angle
    const ANGLE_SEND_THRESHOLD = 0.005; // Radians - minimum change to send
    const angleDifference =
      this.lastSentAngle !== null
        ? Math.abs(
            Phaser.Math.Angle.ShortestBetween(this.lastSentAngle, targetAngle)
          )
        : Infinity; // Always send the first update

    if (angleDifference >= ANGLE_SEND_THRESHOLD) {
      this.playerInputSequence++;
      const inputMsg: PlayerInputMessage = {
        seq: this.playerInputSequence,
        input: "set_angle",
        value: targetAngle,
      };
      this.networkManager.sendMessage("playerInput", inputMsg);
      this.lastSentAngle = targetAngle; // Update last SENT angle
      Logger.trace(
        LOGGER_SOURCE,
        `Sent logical input: set_angle (${targetAngle.toFixed(
          2
        )}), Diff: ${angleDifference.toFixed(3)}`,
        { seq: inputMsg.seq }
      );
    }
  }

  public handlePinchUpdate(
    distanceChange: number,
    currentDistance: number
  ): void {
    // Set local pinch state. InputManager manages start/end.
    this.isPinching = true; // Assume if we get an update, we are pinching

    // Apply zoom based on distance change
    const zoomFactor = distanceChange * 0.005; // Adjust sensitivity
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
      Logger.trace(
        LOGGER_SOURCE,
        `Pinch Zoom Applied: Target=${targetZoom.toFixed(2)}`
      );
    }

    // Use currentDistance for debug if needed
    // Logger.trace(LOGGER_SOURCE, `Current Pinch Distance: ${currentDistance.toFixed(1)}`);
  }

  public handlePointerMove(pointer: Phaser.Input.Pointer): void {
    // Placeholder: Can be used for drag controls or other move-based interactions later
    // Logger.trace(LOGGER_SOURCE, `Pointer Move received: ID ${pointer.id} at ${pointer.x}, ${pointer.y}`);
  }

  // --- Getter for debug state --- //
  public getDebugState(): {
    isPinching: boolean;
    isThrusting: boolean;
  } {
    return {
      isPinching: this.isPinching, // Local state
      isThrusting: this.wasThrusting, // Logical state
    };
  }
}
