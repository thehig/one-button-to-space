import Phaser from "phaser";
import { BaseManager } from "./BaseManager";
import { Client, Room } from "colyseus.js";
import { RoomState } from "../schema/State";
import { Logger } from "@one-button-to-space/shared";
import { DeviceOrientationManager } from "../utils/DeviceOrientationManager";

// Logger Source for this file
const LOGGER_SOURCE = "⌨️🖱️";

interface KeyMap {
  [key: string]: Phaser.Input.Keyboard.Key;
}

/**
 * Handles player input detection. Processing is handled in GameScene.
 */
export class InputManager extends BaseManager {
  public static instance: InputManager;
  private scene: Phaser.Scene | null = null;
  private registeredKeys: KeyMap = {}; // Stores specific keys requested by scenes
  private room: Room<RoomState> | null = null;
  private deviceOrientationManager: DeviceOrientationManager;

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

  public setSceneContext(scene: Phaser.Scene, room: Room<RoomState>): void {
    this.scene = scene;
    this.room = room;
    if (!scene.input.keyboard) {
      Logger.error(
        LOGGER_SOURCE,
        "Keyboard input not available in this scene."
      );
    } else {
      Logger.info(
        LOGGER_SOURCE,
        "InputManager context set for scene:",
        scene.scene.key
      );
    }
  }

  /**
   * Registers specific keys for tracking.
   * @param keyCodes - An array of key codes (e.g., 'W', 'A', 'SPACE', 'LEFT'). Uses Phaser.Input.Keyboard.KeyCodes potentially.
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
      if (!this.registeredKeys[keyCode]) {
        try {
          this.registeredKeys[keyCode] = this.scene!.input.keyboard!.addKey(
            keyCode,
            true // enableCapture set to true to prevent browser default actions for these keys if needed
          );
          Logger.trace(LOGGER_SOURCE, `Registered key: ${keyCode}`);
        } catch (error) {
          Logger.error(
            LOGGER_SOURCE,
            `Failed to register key: ${keyCode}`,
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
    const key = this.registeredKeys[keyCode];
    return key ? key.isDown : false;
  }

  /**
   * Starts listening for device orientation changes.
   * Should be called after user interaction, e.g., a button click.
   */
  public startOrientationListening(): void {
    this.deviceOrientationManager.startListening();
  }

  /**
   * Gets the calculated target rocket angle based on device orientation.
   * @returns The angle in radians (0 right, -PI/2 up), or null if unavailable.
   */
  public getTargetRocketAngleRadians(): number | null {
    return this.deviceOrientationManager.getTargetRocketAngleRadians();
  }

  public override init(): void {
    Logger.info(LOGGER_SOURCE, "Input Manager Initialized");
  }

  public override destroy(): void {
    Logger.info(LOGGER_SOURCE, "Input Manager Destroyed");
    this.deviceOrientationManager.destroy();
    // Clean up registered keys
    Object.values(this.registeredKeys).forEach((key) => key.destroy());
    this.registeredKeys = {};
    this.scene = null;
    this.room = null;
  }
}
