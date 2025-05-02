import Phaser from "phaser";
import type { NetworkManager } from "./NetworkManager";
import type { InputManager } from "./InputManager";
import type { CameraManager } from "./CameraManager";
import type { EntityManager } from "./EntityManager";

/**
 * Debug state information provided by a SceneInputManager.
 */
export interface SceneInputManagerDebugState {
  [key: string]: string | number | boolean;
}

/**
 * Abstract base class for scene-specific input management.
 * Each scene that requires input handling should implement this class.
 */
export abstract class BaseSceneInputManager {
  protected scene: Phaser.Scene;
  protected networkManager: NetworkManager;
  protected inputManager: InputManager;
  protected cameraManager: CameraManager;
  protected entityManager: EntityManager;

  constructor(
    scene: Phaser.Scene,
    networkManager: NetworkManager,
    inputManager: InputManager,
    cameraManager: CameraManager,
    entityManager: EntityManager
  ) {
    this.scene = scene;
    this.networkManager = networkManager;
    this.inputManager = inputManager;
    this.cameraManager = cameraManager;
    this.entityManager = entityManager;
  }

  /**
   * Sets up input listeners specific to the scene.
   * Should be called when the scene is created or ready.
   */
  abstract initialize(): void;

  /**
   * Cleans up input listeners and resources.
   * Should be called when the scene is shut down or destroyed.
   */
  abstract destroy(): void;

  /**
   * Processes input state each frame.
   * Reads from InputManager and potentially sends network messages.
   * @param delta Time elapsed since the last frame in milliseconds.
   */
  abstract processInput(delta: number): void;

  /**
   * Provides state information for debugging purposes.
   * @returns An object containing relevant debug information.
   */
  abstract getDebugState(): SceneInputManagerDebugState;
}
