import Phaser from "phaser";
import { NetworkManager } from "../../../managers/NetworkManager";
import { EntityManager } from "../../../managers/EntityManager";
import { InputManager } from "../../../managers/InputManager"; // Global input manager
import { PhysicsManager } from "../../../managers/PhysicsManager";
import { TimeManager } from "../../../managers/TimeManager";
import { SceneManager } from "../../../managers/SceneManager";
import { Logger } from "@one-button-to-space/shared";
import { CameraManager } from "../../../managers/CameraManager";
import { SceneInputs } from "./SceneInputs"; // Scene-specific input LOGIC handler
import { gameEmitter } from "../../../main";
import { Starfield } from "../../effects/Starfield";
import { StarfieldRenderer } from "../../effects/StarfieldRenderer";
import type { Player } from "../../../entities/Player";

// Logger Source for this file
const LOGGER_SOURCE = "🎮🕹️";

// Debug state structure remains largely the same, but data sources change
interface InputDebugState {
  keysDown: string[]; // From InputManager
  pointer1: {
    id: number;
    x: number;
    y: number;
    active: boolean;
    isDown: boolean;
  }; // From InputManager/Phaser
  pointer2: {
    id: number;
    x: number;
    y: number;
    active: boolean;
    isDown: boolean;
  }; // From InputManager/Phaser
  isPinching: boolean; // Can be from SceneInputs or InputManager internal
  // pinchDistance: number; // Maybe less relevant now or get from InputManager
  isThrusting: boolean; // From SceneInputs (logical state)
  touchActive: boolean; // From Phaser device check
  orientation: {
    // From InputManager
    alpha: number | null;
    beta: number | null;
    gamma: number | null;
    targetAngleRad: number | null; // Raw orientation angle used by InputManager
  };
}

/**
 * The main scene where the core game logic takes place.
 */
export class GameScene extends Phaser.Scene {
  private networkManager!: NetworkManager;
  private entityManager!: EntityManager;
  private inputManager!: InputManager; // Global physical input handler
  private sceneInputManager!: SceneInputs; // Scene-specific logical handler
  private physicsManager!: PhysicsManager;
  private timeManager!: TimeManager;
  private sceneManager!: SceneManager;
  private cameraManager!: CameraManager;
  private starfield!: Starfield;
  private starfieldRenderer!: StarfieldRenderer;

  private lastEmittedDebugState: Partial<InputDebugState> = {};
  private localPlayerReadyListener?: (player: Player) => void;

  constructor() {
    super("GameScene");
  }

  init(): void {
    Logger.info(LOGGER_SOURCE, "GameScene Init");
    // Initialize managers (get instances)
    this.networkManager = NetworkManager.getInstance();
    this.entityManager = EntityManager.getInstance();
    this.inputManager = InputManager.getInstance(); // Global manager
    this.physicsManager = PhysicsManager.getInstance();
    this.timeManager = TimeManager.getInstance();
    this.sceneManager = SceneManager.getInstance(); // Linter fix: removed arg
    this.cameraManager = CameraManager.getInstance();

    // Set scene context for managers that need it early
    this.timeManager.setSceneContext(this);
    this.physicsManager.setSceneContext(this);
    this.inputManager.setSceneContext(this); // InputManager needs scene context for listeners
    this.cameraManager.setSceneContext(this);
    // EntityManager context is set AFTER connection
    // SceneInputManager is created in 'create'
  }

  preload(): void {
    Logger.info(LOGGER_SOURCE, "GameScene Preload");
    // Assets should be preloaded earlier
  }

  async create(): Promise<void> {
    Logger.info(LOGGER_SOURCE, "GameScene Create");

    // --- Connect to Server --- //
    try {
      const playerName = "Player_" + Math.floor(Math.random() * 1000);
      const room = await this.networkManager.connect("game_room", {
        playerName,
      });

      if (room && room.sessionId) {
        Logger.info(
          LOGGER_SOURCE,
          `Connected to room ${room.roomId} with session ID ${room.sessionId}`
        );

        // --- Set Context for Managers needing Network Info ---
        this.entityManager.setSceneContext(this, room.sessionId);

        // --- Create Scene-Specific Input Logic Handler ---
        this.sceneInputManager = new SceneInputs(
          this,
          this.networkManager,
          // No longer pass InputManager
          this.cameraManager,
          this.entityManager
        );
        this.sceneInputManager.initialize();

        // --- Register Scene Handler with Global Input Manager ---
        this.inputManager.setActiveSceneInputHandler(this.sceneInputManager);

        // --- Input Keys/Orientation are handled by InputManager now ---
        // REMOVED: this.inputManager.registerKeys(...);
        // REMOVED: this.inputManager.startOrientationListening(...);

        // --- Setup Event Listener for Local Player --- //
        this.localPlayerReadyListener = (player: Player) => {
          if (
            !this.scene ||
            !this.scene.key ||
            this.scene.key !== "GameScene"
          ) {
            Logger.warn(
              LOGGER_SOURCE,
              `localPlayerReady event ignored, scene ${
                this.scene?.key || "unknown"
              } is no longer active.`
            );
            return;
          }
          if (player) {
            Logger.info(
              LOGGER_SOURCE,
              `localPlayerReady event received. Setting camera target to: ${player.sessionId}`
            );
            this.cameraManager.setTarget(player);
          } else {
            Logger.warn(
              LOGGER_SOURCE,
              "localPlayerReady event received but player object was null/undefined."
            );
          }
        };
        gameEmitter.once("localPlayerReady", this.localPlayerReadyListener);
      } else {
        Logger.error(
          LOGGER_SOURCE,
          "Failed to connect or get session info after connection attempt."
        );
        this.handleConnectionError("Connection failed or session missing.");
      }
    } catch (error: any) {
      Logger.error(LOGGER_SOURCE, "Error connecting to server:", error);
      this.handleConnectionError(error.message || "Unknown connection error");
    }

    // --- Debug --- //
    gameEmitter.emit("phaserVersion", Phaser.VERSION);
    if (import.meta.env.DEV) {
      this.timeManager.addLoop(500, () => {
        const player = this.entityManager.getCurrentPlayer() as
          | Player
          | undefined;
        let playerX: number | undefined,
          playerY: number | undefined,
          playerSpeed: number | undefined;
        if (player) {
          playerX = player.x;
          playerY = player.y;
          playerSpeed = Math.sqrt(player.latestVx ** 2 + player.latestVy ** 2);
        }
        gameEmitter.emit("debugUpdate", {
          fps: this.timeManager.fps,
          entityCount: this.entityManager.getAllEntities().size,
          playerId: this.networkManager.sessionId || "N/A",
          x: playerX,
          y: playerY,
          speed: playerSpeed,
        });
        this.emitInputDebugState();
      });
    }

    // --- Create Starfield --- //
    this.starfield = new Starfield({ seed: 12345 });
    this.starfieldRenderer = new StarfieldRenderer(this, this.starfield, {
      depth: -10,
    });
    this.starfieldRenderer.createTexture();
    this.starfieldRenderer.createTileSprite();

    // Add listener for window resize
    this.scale.on("resize", this.onResize, this);
  }

  update(time: number, delta: number): void {
    // --- Global Input Manager Update (for continuous inputs like orientation) ---
    this.inputManager.update(delta);

    // --- Scene Input Handler Update (for continuous actions like keyboard rotation) ---
    if (this.sceneInputManager) {
      this.sceneInputManager.update(delta);
    }

    // --- Entity Updates (interpolation, etc. - handled by EntityManager/NetworkManager) ---

    // --- Emit Player Angle for HUD --- //
    const localPlayer = this.entityManager.getCurrentPlayer() as
      | Player
      | undefined;
    if (localPlayer) {
      gameEmitter.emit("playerAngleUpdate", localPlayer.rotation);
    }

    // --- Update Starfield --- //
    if (this.starfieldRenderer) {
      this.starfieldRenderer.update();
    }

    // --- Update Camera --- //
    this.cameraManager.update(time, delta);

    // REMOVED: Call to sceneInputManager.processInput
  }

  /**
   * Gathers current input state and emits it if changed significantly.
   * Reads data from InputManager (physical) and SceneInputs (logical).
   */
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

    const sceneInputState = this.sceneInputManager.getDebugState(); // Logical state
    const rawOrientation = this.inputManager.getRawOrientation(); // Physical state
    const orientationAngle =
      this.inputManager.getOrientationTargetAngleRadians(); // Physical state

    const currentState: InputDebugState = {
      keysDown: this.inputManager.getKeysDown(), // Physical
      pointer1: pointer1State, // Physical
      pointer2: pointer2State, // Physical
      touchActive: this.sys.game.device.input.touch, // Device info
      isPinching: sceneInputState.isPinching, // Logical (could also check InputManager.isPinching)
      isThrusting: sceneInputState.isThrusting, // Logical
      orientation: {
        // Physical
        alpha: rawOrientation?.alpha ?? null,
        beta: rawOrientation?.beta ?? null,
        gamma: rawOrientation?.gamma ?? null,
        targetAngleRad: orientationAngle, // Raw angle from sensor
      },
    };

    if (
      JSON.stringify(currentState) !==
      JSON.stringify(this.lastEmittedDebugState)
    ) {
      gameEmitter.emit("inputStateUpdate", currentState);
      this.lastEmittedDebugState = { ...currentState };
    }
  }

  handleConnectionError(message: string): void {
    Logger.error(LOGGER_SOURCE, `Connection Error: ${message}`);
    // Unregister input handler before switching scenes
    if (this.inputManager) {
      this.inputManager.setActiveSceneInputHandler(null);
    }
    this.sceneManager.startScene("MainMenuScene", { error: message });
  }

  onResize(gameSize: Phaser.Structs.Size): void {
    if (!this.cameras?.main) return;
    this.cameras.main.setSize(gameSize.width, gameSize.height);
    Logger.debug(
      LOGGER_SOURCE,
      `Resized to: ${gameSize.width}x${gameSize.height}`
    );
  }

  shutdown(): void {
    Logger.info(LOGGER_SOURCE, `GameScene Shutdown: ${this.scene.key}`);

    // Unregister scene input handler from global manager
    if (this.inputManager) {
      this.inputManager.setActiveSceneInputHandler(null);
    }

    if (this.localPlayerReadyListener) {
      gameEmitter.off("localPlayerReady", this.localPlayerReadyListener);
      this.localPlayerReadyListener = undefined;
    }

    this.scale.off("resize", this.onResize, this);

    // Destroy SceneInputs (logical handler)
    if (this.sceneInputManager) {
      this.sceneInputManager.destroy();
    }

    if (this.networkManager && this.networkManager.isConnected()) {
      this.networkManager.disconnect();
    }

    if (this.starfieldRenderer) {
      this.starfieldRenderer.destroy();
    }
    if (this.cameraManager) {
      this.cameraManager.destroy();
    }
    // Global InputManager cleanup might happen elsewhere or not be needed per-scene
    // if (this.inputManager) { this.inputManager.destroy(); }
  }
}
