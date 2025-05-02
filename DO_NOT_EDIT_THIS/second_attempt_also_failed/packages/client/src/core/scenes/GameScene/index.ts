import Phaser from "phaser";
// Managers are now accessed via EngineManager from the registry
// import { NetworkManager } from "../../../managers/NetworkManager";
// import { EntityManager } from "../../../managers/EntityManager";
// import { InputManager } from "../../../managers/InputManager";
// import { PhysicsManager } from "../../../managers/PhysicsManager";
// import { TimeManager } from "../../../managers/TimeManager";
// import { SceneManager } from "../../../managers/SceneManager";
// import { CameraManager } from "../../../managers/CameraManager";
import { EngineManager } from "../../../managers/EngineManager"; // Import EngineManager type
import { Logger } from "@one-button-to-space/shared";
import { SceneInputs } from "./SceneInputs"; // Scene-specific input LOGIC handler
import { gameEmitter } from "../../../main";
import { Starfield } from "../../effects/Starfield";
import { StarfieldRenderer } from "../../effects/StarfieldRenderer";
import type { Player } from "../../../entities/Player";
import { NetworkManager } from "../../../managers/NetworkManager";
import { EntityManager } from "../../../managers/EntityManager";
import { InputManager } from "../../../managers/InputManager";
import { PhysicsManager } from "../../../managers/PhysicsManager";
import { TimeManager } from "../../../managers/TimeManager";
import { SceneManager } from "../../../managers/SceneManager";
import { CameraManager } from "../../../managers/CameraManager";

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
  // References to managers obtained via EngineManager
  private engineManager!: EngineManager;
  private networkManager!: NetworkManager;
  private entityManager!: EntityManager;
  private inputManager!: InputManager;
  private physicsManager!: PhysicsManager;
  private timeManager!: TimeManager;
  private sceneManager!: SceneManager;
  private cameraManager!: CameraManager;

  private sceneInputManager!: SceneInputs; // Scene-specific logical handler
  private starfield!: Starfield;
  private starfieldRenderer!: StarfieldRenderer;

  private lastEmittedDebugState: Partial<InputDebugState> = {};
  private localPlayerReadyListener?: (player: Player) => void;
  public isSceneReady: boolean = false; // Flag to indicate scene setup completion

  constructor() {
    super("GameScene");
  }

  async init(): Promise<void> {
    this.isSceneReady = false; // Reset readiness flag on init/restart
    Logger.info(LOGGER_SOURCE, "GameScene Init");
    // Get EngineManager from registry
    this.engineManager = this.registry.get("engine");
    if (!this.engineManager) {
      throw new Error("EngineManager not found in registry for GameScene.");
    }

    // Get manager instances from EngineManager
    this.networkManager = this.engineManager.getNetworkManager();
    this.entityManager = this.engineManager.getEntityManager();
    this.inputManager = this.engineManager.getInputManager();
    this.physicsManager = this.engineManager.getPhysicsManager();
    this.timeManager = this.engineManager.getTimeManager();
    this.sceneManager = this.engineManager.getSceneManager();
    this.cameraManager = this.engineManager.getCameraManager();

    // Set scene context for managers that require it
    // These managers now have setSceneContext methods
    this.timeManager.setSceneContext(this);
    this.physicsManager.setSceneContext(this);
    this.inputManager.setSceneContext(this);
    this.cameraManager.setSceneContext(this);
    // EntityManager context is set after connection in create()

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
        // Pass the specific manager instances obtained during init
        this.sceneInputManager = new SceneInputs(
          this,
          this.networkManager, // Already fetched
          this.cameraManager, // Already fetched
          this.entityManager // Already fetched
        );
        this.sceneInputManager.initialize();

        // --- Register Scene Handler with Global Input Manager ---
        this.inputManager.setActiveSceneInputHandler(this.sceneInputManager);

        // --- Input Keys/Orientation are handled by InputManager now ---
        // Key registration might happen here if specific to this scene
        // this.inputManager.registerKeys(['W', 'A', 'D', 'SPACE']); // Example

        // --- Setup Event Listener for Local Player --- //
        // Event emitter pattern remains the same
        this.localPlayerReadyListener = (player: Player) => {
          // Scene activity check is good practice
          if (!this.scene.isActive(this.scene.key)) {
            // Check activity status
            Logger.warn(
              LOGGER_SOURCE,
              `localPlayerReady event ignored, scene ${this.scene.key} is no longer active.`
            );
            return;
          }
          if (player) {
            Logger.info(
              LOGGER_SOURCE,
              `localPlayerReady event received. Setting camera target to: ${player.id}` // Use player.id if available
            );
            this.cameraManager.setTarget(player);
          } else {
            Logger.warn(
              LOGGER_SOURCE,
              "localPlayerReady event received but player object was null/undefined."
            );
          }
        };
        // Use the correct event name if it changed
        gameEmitter.once("currentPlayerCreated", this.localPlayerReadyListener);
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
    // Use manager instances for debug info
    gameEmitter.emit("phaserVersion", Phaser.VERSION);
    if (import.meta.env.DEV) {
      this.timeManager.addLoop(500, () => {
        const player = this.entityManager.getCurrentPlayer(); // No need for casting if types are correct
        gameEmitter.emit("debugUpdate", {
          fps: this.timeManager.fps,
          entityCount: this.entityManager.getAllEntities().size,
          playerId: this.networkManager.sessionId || "N/A",
          x: player?.x,
          y: player?.y,
          speed: player
            ? Math.sqrt(player.latestVx ** 2 + player.latestVy ** 2)
            : undefined,
        });
        this.emitInputDebugState(); // Ensure this method also uses manager instances
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

    // Signal that the scene's core setup is complete
    this.isSceneReady = true;
    Logger.info(LOGGER_SOURCE, "GameScene is ready.");
  }

  update(time: number, delta: number): void {
    // Use manager instances
    this.inputManager.update(delta);

    if (this.sceneInputManager) {
      this.sceneInputManager.update(delta);
    }

    // Entity updates are mostly handled by EntityManager reacting to NetworkManager

    const localPlayer = this.entityManager.getCurrentPlayer();
    if (localPlayer) {
      gameEmitter.emit("playerAngleUpdate", localPlayer.rotation);
    }

    if (this.starfieldRenderer) {
      this.starfieldRenderer.update();
    }

    this.cameraManager.update(time, delta);
  }

  /**
   * Gathers current input state and emits it if changed significantly.
   * Reads data from InputManager (physical) and SceneInputs (logical).
   */
  private emitInputDebugState(): void {
    // Ensure managers are available
    if (!this.inputManager || !this.sceneInputManager || !this.scene.input)
      return;

    const p1 = this.scene.input.pointer1;
    const p2 = this.scene.input.pointer2;

    const currentState: InputDebugState = {
      keysDown: this.inputManager.getKeysDown(),
      pointer1: {
        id: p1.id,
        x: p1.x,
        y: p1.y,
        active: p1.active,
        isDown: p1.isDown,
      },
      pointer2: {
        id: p2.id,
        x: p2.x,
        y: p2.y,
        active: p2.active,
        isDown: p2.isDown,
      },
      isPinching: (this.inputManager as any).isPinching, // Access internal state if needed, ideally expose via getter
      isThrusting: this.sceneInputManager.isThrusting(), // Get logical state
      touchActive: this.scene.sys.game.device.input.touch,
      orientation: {
        ...this.inputManager.getRawOrientation(), // Spread raw values
        targetAngleRad: this.inputManager.getOrientationTargetAngleRadians(),
      },
    };

    // Simple stringify comparison to check for changes
    if (
      JSON.stringify(currentState) !==
      JSON.stringify(this.lastEmittedDebugState)
    ) {
      this.lastEmittedDebugState = { ...currentState }; // Deep copy might be safer if nested objects change
      gameEmitter.emit("debugInputUpdate", currentState);
    }
  }

  handleConnectionError(message: string): void {
    Logger.error(LOGGER_SOURCE, `Connection Error: ${message}`);
    // Use SceneManager obtained via EngineManager
    this.sceneManager.startScene("MainMenuScene", {
      error: message,
    });
  }

  onResize(gameSize: Phaser.Structs.Size): void {
    if (this.starfieldRenderer) {
      this.starfieldRenderer.resize(gameSize.width, gameSize.height);
    }
    // Optionally notify CameraManager or other elements about resize
    // this.cameraManager.handleResize(gameSize); // Example
  }

  shutdown(): void {
    Logger.info(LOGGER_SOURCE, "GameScene Shutdown");

    // Remove event listeners
    gameEmitter.off("localPlayerReady", this.localPlayerReadyListener);
    this.scale.off("resize", this.onResize, this);

    // Clean up scene-specific resources
    if (this.starfieldRenderer) {
      this.starfieldRenderer.destroy();
    }
    if (this.sceneInputManager) {
      this.inputManager.setActiveSceneInputHandler(null); // Deregister handler
      this.sceneInputManager.destroy();
    }

    // Critical: Clear manager contexts related to *this specific scene*
    // This prevents stale references if the scene is restarted
    this.timeManager?.setSceneContext(null); // Clear time context
    this.cameraManager?.setSceneContext(null); // Clear camera context
    // PhysicsManager and InputManager contexts are typically tied to the scene lifecycle
    // EntityManager context might need specific clearing if not handled by its teardown

    // Do NOT disconnect NetworkManager here - that's handled globally or by user action
    // NetworkManager disconnection happens in main.tsx or on user request

    Logger.info(LOGGER_SOURCE, "GameScene Shutdown complete.");
  }
}
