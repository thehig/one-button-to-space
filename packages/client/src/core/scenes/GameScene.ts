import Phaser from "phaser";
import { NetworkManager } from "../../managers/NetworkManager";
import { EntityManager } from "../../managers/EntityManager";
import { InputManager } from "../../managers/InputManager";
import { PhysicsManager } from "../../managers/PhysicsManager";
import { TimeManager } from "../../managers/TimeManager";
import { SceneManager } from "../../managers/SceneManager";
import { Logger } from "@one-button-to-space/shared";
import { CameraManager } from "../../managers/CameraManager";
import { gameEmitter } from "../../main"; // Import the global emitter
// Import effects
import { Starfield } from "../effects/Starfield";
import { StarfieldRenderer } from "../effects/StarfieldRenderer";
// Import specific entity types if needed for direct creation (less common here)
// import { Player } from '../entities/Player';
// Import the PlayerInputMessage type from shared
import type { PlayerInputMessage } from "@one-button-to-space/shared";
import type { Player } from "../../entities/Player"; // Import Player type for casting

// Logger Source for this file
const LOGGER_SOURCE = "🎮🕹️";

// Define the interface for the state we'll emit
interface InputDebugState {
  keysDown: string[];
  pointer1: { id: number; x: number; y: number; active: boolean };
  pointer2: { id: number; x: number; y: number; active: boolean };
  isPinching: boolean;
  pinchDistance: number;
  isThrusting: boolean;
  touchActive: boolean;
  orientation: {
    // Get raw values directly from manager instance if possible, or pass via InputManager
    alpha: number | null;
    beta: number | null;
    gamma: number | null;
    targetAngleRad: number | null; // The final angle used by the game
  };
}

// Threshold for sending angle updates based on orientation
const ORIENTATION_ANGLE_DELTA_THRESHOLD = Phaser.Math.DegToRad(2.5); // Radians (e.g., 2.5 degrees)

const ANGLE_DELTA_THRESHOLD = 0.005; // Radians - only send if change exceeds this for KEYBOARD input

/**
 * The main scene where the core game logic takes place.
 */
export class GameScene extends Phaser.Scene {
  private networkManager!: NetworkManager;
  private entityManager!: EntityManager;
  private inputManager!: InputManager;
  private physicsManager!: PhysicsManager;
  private timeManager!: TimeManager;
  private sceneManager!: SceneManager;
  private cameraManager!: CameraManager;
  private starfield!: Starfield;
  private starfieldRenderer!: StarfieldRenderer;

  // Input state tracking
  private playerInputSequence: number = 0;
  private wasThrusting: boolean = false; // Tracks thrust state from ANY source
  private readonly rotationSpeed: number = Math.PI / 2; // Radians per second (adjust as needed) for keyboard
  private lastSentAngle: number | null = null; // Track last sent angle

  // Touch specific state
  private touchActive: boolean = false; // Flag if touch controls are active
  private pinchStartDistance: number = 0;
  private isPinching: boolean = false;
  private lastEmittedDebugState: Partial<InputDebugState> = {}; // Track last emitted state

  // Scene-specific properties
  // private map: Phaser.Tilemaps.Tilemap | null = null;

  constructor() {
    super("GameScene");
  }

  init(/*data?: object*/): void {
    Logger.info(LOGGER_SOURCE, "GameScene Init");
    // Initialize managers
    this.networkManager = NetworkManager.getInstance();
    this.entityManager = EntityManager.getInstance();
    this.inputManager = InputManager.getInstance();
    this.physicsManager = PhysicsManager.getInstance();
    this.timeManager = TimeManager.getInstance();
    this.sceneManager = SceneManager.getInstance(this.game);
    this.cameraManager = CameraManager.getInstance();

    // Set scene context for managers that DON'T need network info yet
    this.timeManager.setSceneContext(this);
    this.physicsManager.setSceneContext(this);
    // InputManager context is set AFTER connection, when we have client/room
    // EntityManager context is set AFTER connection, when we have sessionId
  }

  preload(): void {
    Logger.info(LOGGER_SOURCE, "GameScene Preload");
    // Assets should ideally be preloaded in BootScene or a dedicated PreloadScene
    // Only load assets here if they are specific to *just* this scene and not needed before
  }

  async create(/*data?: object*/): Promise<void> {
    Logger.info(LOGGER_SOURCE, "GameScene Create");

    // --- Setup Physics --- (Example: world bounds)
    // Since it's top-down and server-auth, bounds might be less critical or handled server-side
    // this.matter.world.setBounds(0, 0, 1600, 1200);

    // Input keys will be registered after connection

    // --- Connect to Server --- //
    try {
      // TODO: Replace 'my_room' and provide actual player options from UI/storage
      const playerName = "Player_" + Math.floor(Math.random() * 1000);
      const room = await this.networkManager.connect("game_room", {
        playerName,
      });

      // Check only for room and sessionId, as client object isn't needed here anymore
      if (room && room.sessionId) {
        // const client = this.networkManager.getClient()!; // Removed client retrieval
        Logger.info(
          LOGGER_SOURCE,
          `Connected to room ${room.roomId} with session ID ${room.sessionId}`
        );

        // --- Set Context for Managers needing Network Info ---
        this.entityManager.setSceneContext(this, room.sessionId);
        this.inputManager.setSceneContext(this, room); // Removed client argument
        this.cameraManager.setSceneContext(this);

        // --- Register Input Keys NOW that InputManager context is set ---
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

        // --- Setup Touch Input IF on mobile --- //
        if (this.sys.game.device.input.touch) {
          this.touchActive = true;
          Logger.info(
            LOGGER_SOURCE,
            "Mobile device detected, setting up touch listeners and attempting orientation."
          );
          // Add tap listeners
          this.input.on(
            Phaser.Input.Events.POINTER_DOWN,
            this.handleTapStart,
            this
          );
          this.input.on(
            Phaser.Input.Events.POINTER_UP,
            this.handleTapEnd,
            this
          );
          // Add pinch listeners (using pointer move)
          this.input.on(
            Phaser.Input.Events.POINTER_MOVE,
            this.handlePointerMove,
            this
          );

          // Delay slightly to ensure DOM/permissions might be ready after initial load
          this.time.delayedCall(500, () => {
            this.inputManager.startOrientationListening();
          });
        } else {
          Logger.info(
            LOGGER_SOURCE,
            "Non-mobile device detected, touch/orientation controls disabled."
          );
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
      });
    }

    // Example: Add a simple background or tilemap
    // this.add.image(0, 0, 'background').setOrigin(0);
    // this.map = this.make.tilemap({ key: 'map' });
    // const tileset = this.map.addTilesetImage('my_tileset', 'tiles');
    // this.map.createLayer('Ground', tileset);
    // this.map.createLayer('Walls', tileset).setCollisionByProperty({ collides: true });
    // this.matter.world.convertTilemapLayer(this.map.getLayer('Walls').tilemapLayer);

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
    this.processAndSendInput(delta);
    // --- Pinch Update (only if touch is active) --- //
    let pinchDistanceForDebug = 0;
    if (this.touchActive) {
      pinchDistanceForDebug = this.updatePinchZoom();
    }

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

    // --- Emit Input Debug State (if DEV) --- //
    if (import.meta.env.DEV) {
      this.emitInputDebugState(pinchDistanceForDebug);
    }
  }

  /**
   * Handles the start of a touch input (tap).
   */
  private handleTapStart(pointer: Phaser.Input.Pointer): void {
    Logger.debug(
      LOGGER_SOURCE,
      `handleTapStart triggered by pointer ID: ${pointer.id}`
    );
    // Only handle primary touch for thrust to avoid multi-touch issues
    if (!this.touchActive || !pointer.isDown || this.input.pointer1 !== pointer)
      return;

    // Ignore if pinching
    if (this.isPinching || this.input.pointer2.isDown) {
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

  /**
   * Handles the end of a touch input (tap release).
   */
  private handleTapEnd(pointer: Phaser.Input.Pointer): void {
    Logger.debug(
      LOGGER_SOURCE,
      `handleTapEnd triggered by pointer ID: ${pointer.id}`
    );
    // Only handle primary touch for thrust
    if (!this.touchActive || this.input.pointer1 !== pointer) return;

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

  /**
   * Handles pointer movement, primarily for detecting pinch start.
   */
  private handlePointerMove(pointer: Phaser.Input.Pointer): void {
    // Logger.debug(LOGGER_SOURCE, `handlePointerMove triggered by pointer ID: ${pointer.id}`); // Can be very spammy
    if (!this.touchActive) return;

    const p1 = this.input.pointer1;
    const p2 = this.input.pointer2;

    // Check if starting a pinch (both pointers down, not already pinching)
    if (p1.isDown && p2.isDown && !this.isPinching) {
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

  /**
   * Calculates pinch zoom changes in the update loop.
   * @returns The current pinch distance for debugging purposes.
   */
  private updatePinchZoom(): number {
    // Logger.debug(LOGGER_SOURCE, `updatePinchZoom called. isPinching: ${this.isPinching}`); // Potentially spammy
    const p1 = this.input.pointer1;
    const p2 = this.input.pointer2;
    let currentDistance = 0;

    if (this.isPinching) {
      // If one pointer lifts, stop pinching
      if (!p1.isDown || !p2.isDown) {
        this.isPinching = false;
        this.pinchStartDistance = 0;
        Logger.trace(LOGGER_SOURCE, "Pinch ended (one pointer up).");
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
          this.cameraManager.config.minZoom,
          this.cameraManager.config.maxZoom
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

  /**
   * Process player input and send relevant messages to the server.
   * @param delta - Time elapsed since the last frame in milliseconds.
   */
  processAndSendInput(delta: number): void {
    // Check if InputManager instance exists and network is connected
    if (!this.inputManager || !this.networkManager.isConnected()) return;

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
        const player = this.entityManager.getCurrentPlayer() as
          | Player
          | undefined;
        if (player) {
          usingKeyboardRotation = true;
          const rotationDelta = (this.rotationSpeed * delta) / 1000; // Convert delta ms to seconds
          // Start keyboard rotation from last SENT angle to avoid jumps when switching from orientation
          let keyboardTargetAngle = this.lastSentAngle ?? player.rotation;

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

    // --- Action Input (Example - Not implemented for server yet) --- //
    // Remains commented out
  }

  /**
   * Gathers current input state and emits it if changed significantly.
   */
  private emitInputDebugState(currentPinchDistance: number): void {
    if (!this.inputManager) return;

    const p1 = this.input.pointer1;
    const p2 = this.input.pointer2;

    // Safely get pointer states
    const pointer1State = p1
      ? { id: p1.id, x: p1.x, y: p1.y, active: p1.active }
      : { id: -1, x: 0, y: 0, active: false };
    const pointer2State = p2
      ? { id: p2.id, x: p2.x, y: p2.y, active: p2.active }
      : { id: -1, x: 0, y: 0, active: false };

    // Get orientation data - NOTE: Requires access to raw data
    // For now, just showing the final angle. Need InputManager/DeviceOrientationManager update for raw data.
    const finalOrientationAngle = this.touchActive
      ? this.inputManager.getTargetRocketAngleRadians() // Re-calculate with offset for display consistency
      : null;

    const currentState: InputDebugState = {
      keysDown: Object.entries(this.inputManager.registeredKeys)
        .filter(([, key]) => key.isDown)
        .map(([code]) => code),
      pointer1: pointer1State,
      pointer2: pointer2State,
      touchActive: this.touchActive,
      isPinching: this.isPinching,
      pinchDistance: currentPinchDistance,
      isThrusting: this.wasThrusting,
      orientation: {
        alpha: null, // Placeholder - requires manager update
        beta: null, // Placeholder - requires manager update
        gamma: null, // Placeholder - requires manager update
        targetAngleRad: finalOrientationAngle,
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

    // Remove touch listeners IF they were added
    if (this.touchActive) {
      this.input.off(
        Phaser.Input.Events.POINTER_DOWN,
        this.handleTapStart,
        this
      );
      this.input.off(Phaser.Input.Events.POINTER_UP, this.handleTapEnd, this);
      this.input.off(
        Phaser.Input.Events.POINTER_MOVE,
        this.handlePointerMove,
        this
      );
    }

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
  }
}
