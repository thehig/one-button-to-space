import Phaser from "phaser";
import { CommunicationManager } from "./CommunicationManager";

export default class InputManager {
  private scene: Phaser.Scene;
  private cursors?: Phaser.Types.Input.Keyboard.CursorKeys;
  private eventEmitter: Phaser.Events.EventEmitter;
  private communicationManager: CommunicationManager;

  constructor(
    scene: Phaser.Scene,
    eventEmitter: Phaser.Events.EventEmitter,
    communicationManager: CommunicationManager
  ) {
    this.scene = scene;
    this.eventEmitter = eventEmitter;
    this.communicationManager = communicationManager;
    this.communicationManager.logEvent("InputManager", "constructor");
  }

  init() {
    this.communicationManager.logEvent("InputManager", "initStart");
    // Initialize input listeners (keyboard, mouse, touch)
    if (this.scene.input.keyboard) {
      this.cursors = this.scene.input.keyboard.createCursorKeys();
    }
    this.scene.input.on("pointerdown", this.handlePointerDown, this);
    this.communicationManager.logEvent("InputManager", "initComplete");
  }

  create() {
    this.communicationManager.logEvent("InputManager", "create");
    // Set up specific input contexts or states if needed
  }

  update(time: number, delta: number) {
    // Poll input states and emit events
    if (!this.cursors) return;

    const inputPayload = {
      left: this.cursors.left.isDown,
      right: this.cursors.right.isDown,
      up: this.cursors.up.isDown,
      down: this.cursors.down.isDown,
      space: this.cursors.space.isDown,
    };

    // Example: Emit an event with the current input state
    this.eventEmitter.emit("inputUpdate", inputPayload);
  }

  handlePointerDown(pointer: Phaser.Input.Pointer) {
    const payload = { x: pointer.x, y: pointer.y };
    this.communicationManager.logEvent("InputManager", "pointerDown", payload);
    // Emit an event for pointer clicks
    this.eventEmitter.emit("pointerDown", payload);
  }

  shutdown() {
    this.communicationManager.logEvent("InputManager", "shutdownStart");
    // Remove listeners
    if (this.scene.input) {
      this.scene.input.off("pointerdown", this.handlePointerDown, this);
    }
    // Keyboard listeners managed by Phaser are typically cleaned up automatically
    // if created via createCursorKeys
    this.communicationManager.logEvent("InputManager", "shutdownComplete");
  }
}
