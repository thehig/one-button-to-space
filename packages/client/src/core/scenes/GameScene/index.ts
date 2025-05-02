import { TimeManager } from "../../managers/TimeManager";
import { SceneManager } from "../../managers/SceneManager";
import { Logger } from "@one-button-to-space/shared";
import { CameraManager } from "../../managers/CameraManager";
import { SceneInputs } from "./SceneInputs";
import { gameEmitter } from "../../main";
import { Starfield } from "../effects/Starfield";

export class GameScene extends Phaser.Scene {
  private networkManager!: NetworkManager;
  private entityManager!: EntityManager;
  private inputManager!: InputManager;
  private sceneInputManager!: SceneInputs;
  private physicsManager!: PhysicsManager;
  private timeManager!: TimeManager;
  private sceneManager!: SceneManager;

  create(): void {
    this.entityManager.setSceneContext(this, room.sessionId);
    this.inputManager.setSceneContext(this);

    this.sceneInputManager = new SceneInputs(
      this,
      this.networkManager,
      this.inputManager
    );

    this.scale.on("resize", this.onResize, this);
  }

  update(time: number, delta: number): void {
    if (!this.sceneInputManager) {
      return;
    }

    this.sceneInputManager.update(time, delta);
  }

  private emitInputDebugState(): void {
    if (!this.inputManager || !this.sceneInputManager) return;

    const p1 = this.input.pointer1;
    const p2 = this.input.pointer2;

    const pointer1State = p1
      ? { id: p1.id, x: p1.x, y: p1.y, active: p1.active, isDown: p1.isDown }
      : { id: -1, x: 0, y: 0, active: false, isDown: false };

    const pointer2State = p2
      ? { id: p2.id, x: p2.x, y: p2.y, active: p2.active, isDown: p2.isDown }
      : { id: -1, x: 0, y: 0, active: false, isDown: false };

    const sceneInputState = this.sceneInputManager.getDebugState();

    const rawOrientation = this.inputManager.getRawOrientation();

    const inputDebugState = {
      pointer1: pointer1State,
      pointer2: pointer2State,
      pinchDistance: sceneInputState.pinchDistance,
      isThrusting: sceneInputState.isThrusting,
      orientation: {
        alpha: rawOrientation?.alpha ?? null,
        beta: rawOrientation?.beta ?? null,
        gamma: rawOrientation?.gamma ?? null,
      },
    };

    gameEmitter.emit("inputDebugState", inputDebugState);

    this.localPlayerReadyListener = undefined;
  }

  private onResize(): void {
    // Implementation of onResize method
  }

  destroy(): void {
    this.scale.off("resize", this.onResize, this);

    if (this.sceneInputManager) {
      this.sceneInputManager.destroy();
    }
  }
}
