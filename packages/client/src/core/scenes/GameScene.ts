import Phaser from "phaser";
import { NetworkManager } from "../../managers/NetworkManager";
import { EntityManager } from "../../managers/EntityManager";
import { InputManager } from "../../managers/InputManager";
import { PhysicsManager } from "../../managers/PhysicsManager";
import { TimeManager } from "../../managers/TimeManager";
import { SceneManager } from "../../managers/SceneManager";
import { Logger } from "@one-button-to-space/shared";
import { CameraManager } from "../../managers/CameraManager";
import { SceneInputManager } from "../../managers/SceneInputManager"; // Import SceneInputManager
import { gameEmitter } from "../../main"; // Import the global emitter
// Import effects
import { Starfield } from "../effects/Starfield";
import { StarfieldRenderer } from "../effects/StarfieldRenderer";
// Import specific entity types if needed for direct creation (less common here)
// import { Player } from '../entities/Player';
// Import the PlayerInputMessage type from shared
// import type { PlayerInputMessage } from "@one-button-to-space/shared"; // No longer needed here
import type { Player } from "../../entities/Player"; // Import Player type for casting

// Logger Source for this file
const LOGGER_SOURCE = "🎮🕹️";

// Define the interface for the state we'll emit
// Moved relevant parts to SceneInputManager, keeping base structure for Debug UI
interface InputDebugState {
  keysDown: string[];
  pointer1: {
    id: number;
    x: number;
    y: number;
    active: boolean;
    isDown: boolean;
  };
  pointer2: {
    id: number;
    x: number;
    y: number;
    active: boolean;
    isDown: boolean;
  };
  isPinching: boolean; // Now comes from SceneInputManager
  pinchDistance: number; // Now comes from SceneInputManager
  isThrusting: boolean; // Now comes from SceneInputManager
  touchActive: boolean; // Now comes from SceneInputManager
  orientation: {
    // Comes from global InputManager
    alpha: number | null;
    beta: number | null;
    gamma: number | null;
    targetAngleRad: number | null; // The final angle used by the game (calculated in SceneInputManager, read from InputManager)
  };
}

// Threshold constants moved to SceneInputManager

/**
 * The main scene where the core game logic takes place.
 */
export class GameScene extends Phaser.Scene {
  private networkManager!: NetworkManager;
  private entityManager!: EntityManager;
  private inputManager!: InputManager; // Global input handler (keys, orientation)
  private sceneInputManager!: SceneInputManager; // Scene-specific input processing
  private physicsManager!: PhysicsManager;
  private timeManager!: TimeManager;
  private sceneManager!: SceneManager;
  private cameraManager!: CameraManager;
  private starfield!: Starfield;
  private starfieldRenderer!: StarfieldRenderer;

  // Input state tracking - MOVED TO SceneInputManager
  // private playerInputSequence: number = 0;
  // private wasThrusting: boolean = false;
  // private readonly rotationSpeed: number = Math.PI / 2;
  // private lastSentAngle: number | null = null;

  // Touch specific state - MOVED TO SceneInputManager
  // private touchActive: boolean = false;
  // private pinchStartDistance: number = 0;
  // private isPinching: boolean = false;
  private lastEmittedDebugState: Partial<InputDebugState> = {}; // Track last emitted state

  // Scene-specific properties
  // private map: Phaser.Tilemaps.Tilemap | null = null;

  constructor() {
    super("GameScene");
  }

  init(/*data?: object*/): void {
    Logger.info(LOGGER_SOURCE, "GameScene Init");
    // Initialize managers (get instances)
    this.networkManager = NetworkManager.getInstance();
    this.entityManager = EntityManager.getInstance();
    this.inputManager = InputManager.getInstance(); // Global manager
    this.physicsManager = PhysicsManager.getInstance();
    this.timeManager = TimeManager.getInstance();
    this.sceneManager = SceneManager.getInstance(this.game);
    this.cameraManager = CameraManager.getInstance();
    // SceneInputManager is created in 'create' after network connection

    // Set scene context for managers that DON'T need network info yet
    this.timeManager.setSceneContext(this);
    this.physicsManager.setSceneContext(this);
    this.inputManager.setSceneContext(this); // Global InputManager still needs scene context
    // EntityManager context is set AFTER connection, when we have sessionId
    this.cameraManager.setSceneContext(this); // CameraManager needs scene context early
  }

  preload(): void {
    Logger.info(LOGGER_SOURCE, "GameScene Preload");
    // Assets should ideally be preloaded in BootScene or a dedicated PreloadScene
    // Only load assets here if they are specific to *just* this scene and not needed before
  }

  async create(/*data?: object*/): Promise<void> {
    Logger.info(LOGGER_SOURCE, "GameScene Create");

    // --- Setup Physics --- (Example: world bounds)
    // this.matter.world.setBounds(0, 0, 1600, 1200);

    // Input keys will be registered after connection and SceneInputManager init

    // --- Connect to Server --- //
    try {
      // TODO: Replace 'my_room' and provide actual player options from UI/storage
      const playerName = "Player_" + Math.floor(Math.random() * 1000);
      const room = await this.networkManager.connect("game_room", {
        playerName,
      });

      // Check only for room and sessionId
      if (room && room.sessionId) {
        Logger.info(
          LOGGER_SOURCE,
          `Connected to room ${room.roomId} with session ID ${room.sessionId}`
        );

        // --- Set Context for Managers needing Network Info ---
        this.entityManager.setSceneContext(this, room.sessionId);
        // InputManager context already set in init

        // --- Create and Initialize SceneInputManager NOW ---
        this.sceneInputManager = new SceneInputManager(
          this,
          this.networkManager,
          this.inputManager, // Pass global InputManager
          this.cameraManager, // Pass CameraManager for pinch zoom
          this.entityManager // Pass EntityManager
        );
        this.sceneInputManager.initialize(); // Sets up touch listeners etc.

        // --- Register Input Keys via Global Input Manager ---
        this.inputManager.registerKeys([
          "W",
          "A",
          "S",
          "D",
          "SPACE",
          "UP",
          "LEFT",
          "DOWN",
          "RIGHT",
        ]);

        // --- Start Orientation Listening (if needed) ---
        // SceneInputManager checks touch support in initialize. We trigger listening here.
        if (this.sys.game.device.input.touch) {
          // Delay slightly to ensure DOM/permissions might be ready after initial load
          this.time.delayedCall(500, () => {
            this.inputManager.startOrientationListening(); // Global InputManager handles this
          });
        }

        // Initial state sync will be triggered by NetworkManager listener
        this.time.delayedCall(100, () => {
          const player = this.entityManager.getCurrentPlayer() as
            | Player
            | undefined;
          if (player) {
            this.cameraManager.setTarget(player);
          } else {
            Logger.warn(
              LOGGER_SOURCE,
              "Player not found after connection. This might be normal if the player is created shortly after connection."
            );
          }
        });
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

    // --- Debug --- (Optional: Display FPS)
    // Emit Phaser version once
    gameEmitter.emit("phaserVersion", Phaser.VERSION);
    if (import.meta.env.DEV) {
      // Setup timed event to emit debug updates
      this.timeManager.addLoop(500, () => {
        const player = this.entityManager.getCurrentPlayer() as
          | Player
          | undefined;

        let playerX: number | undefined;
        let playerY: number | undefined;
        let playerSpeed: number | undefined;

        if (player) {
          playerX = player.x; // Visual position
          playerY = player.y; // Visual position
          // Calculate speed from the player's cached server velocity
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
        // Also emit input debug state here
        this.emitInputDebugState();
      });
    }

    // Example: Add a simple background or tilemap
    // ... (Background/Tilemap setup remains the same) ...

    // --- Create Starfield --- //
    this.starfield = new Starfield({ seed: 12345 }); // Use a fixed seed for consistency
    this.starfieldRenderer = new StarfieldRenderer(this, this.starfield, {
      // textureKey: 'customStarfield', // Optional: override default key
      depth: -10, // Ensure it's behind everything
      // backgroundColor: null // Optional: Make texture background transparent
    });
    this.starfieldRenderer.createTexture(); // Create the texture data
    this.starfieldRenderer.createTileSprite(); // Create the visual object

    // Add listener for window resize
    this.scale.on("resize", this.onResize, this);
  }

  update(time: number, delta: number): void {
    // --- Input Handling --- //
    // Delegate to SceneInputManager
    if (this.sceneInputManager) {
      this.sceneInputManager.processInput(delta);
    }
    // --- Pinch Update (handled within SceneInputManager.processInput now) --- //
    // let pinchDistanceForDebug = 0; // Removed
    // if (this.touchActive) { // Removed
    //   pinchDistanceForDebug = this.updatePinchZoom(); // Removed
    // }

    // --- Entity Updates --- (Handled by Phaser loop + updateFromServer)

    // --- Emit Player Angle for HUD ---
    const localPlayer = this.entityManager.getCurrentPlayer() as
      | Player
      | undefined;
    if (localPlayer) {
      // Emit the visual rotation angle
      gameEmitter.emit("playerAngleUpdate", localPlayer.rotation);
    }

    // --- Update Starfield --- //
    if (this.starfieldRenderer) {
      this.starfieldRenderer.update(); // Update tile position based on camera
    }

    // --- Update Camera --- //
    this.cameraManager.update(time, delta);

    // --- Manager Updates --- (If needed)

    // --- Emit Input Debug State (Triggered by timed loop in create now) --- //
    // if (import.meta.env.DEV) { // Removed from here
    //   this.emitInputDebugState(/*pinchDistanceForDebug*/); // Argument removed
    // }
  }

  // --- Input Handling Methods REMOVED ---
  // private handleTapStart(pointer: Phaser.Input.Pointer): void { ... }
  // private handleTapEnd(pointer: Phaser.Input.Pointer): void { ... }
  // private handlePointerMove(pointer: Phaser.Input.Pointer): void { ... }
  // private updatePinchZoom(): number { ... }
  // processAndSendInput(delta: number): void { ... }

  /**
   * Gathers current input state and emits it if changed significantly.
   * Reads data from InputManager and SceneInputManager.
   */
  private emitInputDebugState(/* Removed pinchDistance argument */): void {
    if (!this.inputManager || !this.sceneInputManager) return;

    const p1 = this.input.pointer1;
    const p2 = this.input.pointer2;

    // Safely get pointer states from Phaser input plugin
    const pointer1State = p1
      ? { id: p1.id, x: p1.x, y: p1.y, active: p1.active, isDown: p1.isDown }
      : { id: -1, x: 0, y: 0, active: false, isDown: false };
    const pointer2State = p2
      ? { id: p2.id, x: p2.x, y: p2.y, active: p2.active, isDown: p2.isDown }
      : { id: -1, x: 0, y: 0, active: false, isDown: false };

    // Get scene-specific state from SceneInputManager
    const sceneInputState = this.sceneInputManager.getDebugState();

    // Get orientation data from global InputManager
    const rawOrientation = this.inputManager.getRawOrientation();
    // Only get the target angle if touch is active, mimicking original conditional logic
    const finalOrientationAngle = sceneInputState.touchActive
      ? this.inputManager.getTargetRocketAngleRadians()
      : null;

    const currentState: InputDebugState = {
      keysDown: this.inputManager.getKeysDown(), // From global InputManager
      pointer1: pointer1State,
      pointer2: pointer2State,
      touchActive: sceneInputState.touchActive, // From SceneInputManager
      isPinching: sceneInputState.isPinching, // From SceneInputManager
      pinchDistance: sceneInputState.pinchDistance, // From SceneInputManager
      isThrusting: sceneInputState.isThrusting, // From SceneInputManager
      orientation: {
        alpha: rawOrientation?.alpha ?? null, // From global InputManager
        beta: rawOrientation?.beta ?? null, // From global InputManager
        gamma: rawOrientation?.gamma ?? null, // From global InputManager
        targetAngleRad: finalOrientationAngle, // From global InputManager (final calculated value potentially used by SceneInputManager)
      },
    };

    // Basic change detection (can be made more granular)
    if (
      JSON.stringify(currentState) !==
      JSON.stringify(this.lastEmittedDebugState)
    ) {
      gameEmitter.emit("inputStateUpdate", currentState);
      this.lastEmittedDebugState = { ...currentState }; // Store a copy
    }
  }

  handleConnectionError(message: string): void {
    Logger.error(LOGGER_SOURCE, `Connection Error: ${message}`);
    // Optional: Add a delay or visual feedback before transitioning
    this.sceneManager.startScene("MainMenuScene", { error: message });
    // If MainMenuScene doesn't exist yet, just log or show an alert.
  }

  onResize(
    gameSize: Phaser.Structs.Size /*, baseSize, displaySize, resolution*/
  ): void {
    if (!this.cameras || !this.cameras.main) return;
    this.cameras.main.setSize(gameSize.width, gameSize.height);
    // Adjust other UI elements or game layout if needed
    Logger.debug(
      LOGGER_SOURCE,
      `Resized to: ${gameSize.width}x${gameSize.height}`
    );
  }

  shutdown(): void {
    Logger.info(LOGGER_SOURCE, "GameScene Shutdown");
    // Clean up scene-specific resources and listeners
    this.scale.off("resize", this.onResize, this);

    // Destroy SceneInputManager (which removes its listeners)
    if (this.sceneInputManager) {
      this.sceneInputManager.destroy();
      // this.sceneInputManager = null; // Optional: Explicitly nullify
    }

    // Remove touch listeners IF they were added - MOVED TO SceneInputManager.destroy()
    // if (this.touchActive) { ... } // Removed

    // Attempt to disconnect if the network manager still exists
    if (this.networkManager && this.networkManager.isConnected()) {
      this.networkManager.disconnect();
    }

    // Destroy starfield renderer
    if (this.starfieldRenderer) {
      this.starfieldRenderer.destroy();
    }

    // Destroy CameraManager
    if (this.cameraManager) {
      this.cameraManager.destroy();
    }

    // Destroy other managers if needed (often handled globally)
    if (this.inputManager) {
      this.inputManager.destroy(); // Global input manager cleanup
    }
  }
}
