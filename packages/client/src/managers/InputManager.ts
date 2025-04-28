import Phaser from "phaser";
import { BaseManager } from "./BaseManager";

interface KeyMap {
  [key: string]: Phaser.Input.Keyboard.Key;
}

export class InputManager extends BaseManager {
  private static _instance: InputManager | null = null;
  private scene: Phaser.Scene | null = null;
  private keys: KeyMap = {};
  // Add properties for mouse/touch input if needed
  // private pointer: Phaser.Input.Pointer | null = null;

  private constructor() {
    super();
  }

  public static getInstance(): InputManager {
    if (!InputManager._instance) {
      InputManager._instance = new InputManager();
    }
    return InputManager._instance;
  }

  public setSceneContext(scene: Phaser.Scene): void {
    this.scene = scene;
    this.keys = {}; // Reset keys for the new scene
    // Initialize pointer if used
    // this.pointer = this.scene.input.activePointer;
  }

  /**
   * Register specific keys to listen for.
   * @param keyCodes Array of key codes (e.g., ['W', 'A', 'S', 'D', 'SPACE']).
   */
  public registerKeys(keyCodes: string[]): void {
    if (!this.scene || !this.scene.input || !this.scene.input.keyboard) return;
    keyCodes.forEach((code) => {
      // Check if key already exists to avoid Phaser warnings
      if (!this.keys[code]) {
        this.keys[code] = this.scene!.input.keyboard!.addKey(code);
      }
    });
  }

  public isKeyDown(keyCode: string): boolean {
    return this.keys[keyCode]?.isDown ?? false;
  }

  public isKeyJustDown(keyCode: string): boolean {
    // Ensure key exists before checking JustDown
    return this.keys[keyCode]
      ? Phaser.Input.Keyboard.JustDown(this.keys[keyCode])
      : false;
  }

  public isKeyJustUp(keyCode: string): boolean {
    // Ensure key exists before checking JustUp
    return this.keys[keyCode]
      ? Phaser.Input.Keyboard.JustUp(this.keys[keyCode])
      : false;
  }

  // Add methods for mouse/touch input as needed
  // public getPointerPosition(): Phaser.Math.Vector2 {
  //     return this.pointer?.position ?? new Phaser.Math.Vector2(0, 0);
  // }
  // public isPointerDown(): boolean {
  //     return this.pointer?.isDown ?? false;
  // }

  public override init(): void {
    console.log("Input Manager Initialized");
    // Potentially set up global input listeners if needed outside scenes
  }

  public override destroy(): void {
    console.log("Input Manager Destroyed");
    // Check if scene and keyboard exist before trying to remove keys
    if (this.scene && this.scene.input && this.scene.input.keyboard) {
      Object.keys(this.keys).forEach((code) => {
        // Check if the key object exists before attempting removal
        if (this.keys[code]) {
          this.scene?.input.keyboard?.removeKey(code);
        }
      });
    }
    this.keys = {};
    this.scene = null;
    InputManager._instance = null;
  }

  // Update could poll input state if not using event-driven approach
  // public override update(time: number, delta: number): void {
  //     super.update(time, delta);
  // }
}
