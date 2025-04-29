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

const ANGLE_DELTA_THRESHOLD = 0.005; // Radians - only send if change exceeds this

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
  private wasThrusting: boolean = false;
  private readonly rotationSpeed: number = Math.PI / 2; // Radians per second (adjust as needed)
  private lastSentAngle: number | null = null; // Track last sent angle

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
          "S", // Still register S if needed for other client-side actions
          "D",
          "SPACE", // Register space if needed
          "UP",
          "LEFT",
          "DOWN", // Register down if needed
          "RIGHT",
        ]);

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
        gameEmitter.emit("debugUpdate", {
          fps: this.timeManager.fps,
          entityCount: this.entityManager.getAllEntities().size,
          playerId: this.networkManager.sessionId || "N/A",
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
    // --- Input Handling --- // Call the new method
    this.processAndSendInput(delta);

    // --- Entity Updates --- (Handled by Phaser loop + updateFromServer)

    // --- Update Starfield --- //
    if (this.starfieldRenderer) {
      this.starfieldRenderer.update(); // Update tile position based on camera
    }

    // --- Update Camera --- //
    this.cameraManager.update(time, delta);

    // --- Manager Updates --- (If needed)
  }

  /**
   * Process player input and send relevant messages to the server.
   * @param delta - Time elapsed since the last frame in milliseconds.
   */
  processAndSendInput(delta: number): void {
    // Check if InputManager instance exists and network is connected
    if (!this.inputManager || !this.networkManager.isConnected()) return;

    // --- Thrust Input --- //
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
      Logger.trace(LOGGER_SOURCE, "Sent input: thrust_start", {
        seq: inputMsg.seq,
      });
    } else if (!isThrusting && this.wasThrusting) {
      // Stopped thrusting
      this.playerInputSequence++;
      const inputMsg: PlayerInputMessage = {
        seq: this.playerInputSequence,
        input: "thrust_stop",
      };
      this.networkManager.sendMessage("playerInput", inputMsg);
      Logger.trace(LOGGER_SOURCE, "Sent input: thrust_stop", {
        seq: inputMsg.seq,
      });
    }
    this.wasThrusting = isThrusting; // Update state for next frame

    // --- Rotation Input --- //
    const rotateLeft =
      this.inputManager.isKeyDown("A") || this.inputManager.isKeyDown("LEFT");
    const rotateRight =
      this.inputManager.isKeyDown("D") || this.inputManager.isKeyDown("RIGHT");

    if (rotateLeft || rotateRight) {
      const player = this.entityManager.getCurrentPlayer() as
        | Player
        | undefined;
      if (player) {
        const rotationDelta = (this.rotationSpeed * delta) / 1000; // Convert delta ms to seconds
        let targetAngle = player.rotation; // Start with current visual angle

        if (rotateLeft) {
          targetAngle -= rotationDelta;
        }
        if (rotateRight) {
          targetAngle += rotationDelta;
        }

        // Normalize angle to be within -PI to PI
        targetAngle = Phaser.Math.Angle.Wrap(targetAngle);

        // --- Delta Check ---
        // Only send if the change is significant or it's the first message
        const angleDifference =
          this.lastSentAngle !== null
            ? Math.abs(
                Phaser.Math.Angle.ShortestBetween(
                  this.lastSentAngle,
                  targetAngle
                )
              )
            : Infinity; // Always send the first message

        if (angleDifference < ANGLE_DELTA_THRESHOLD) {
          // Logger.trace(LOGGER_SOURCE, `Skipping angle update: delta ${angleDifference.toFixed(3)} < ${ANGLE_DELTA_THRESHOLD}`);
          return; // Skip sending if change is too small
        }

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
          `Sent input: set_angle (${targetAngle.toFixed(2)})`,
          { seq: inputMsg.seq }
        );

        // Optional: Client-side prediction - apply rotation visually immediately
        // player.setRotation(targetAngle);
      }
    }

    // --- Action Input (Example - Not implemented for server yet) --- //
    // const actionPressed = this.inputManager.isKeyJustDown("SPACE"); // Need isKeyJustDown in InputManager if used
    // if (actionPressed) {
    //   this.playerInputSequence++;
    //   const inputMsg = { seq: this.playerInputSequence, input: "action_fire" }; // Define message type
    //   this.networkManager.sendMessage("playerInput", inputMsg);
    // }
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
    // Managers are typically destroyed globally or when the game instance is destroyed,
    // but if a manager holds scene-specific resources, clean them here.
    // this.entityManager.clearSceneSpecificData(); // Example

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
