import Phaser from "phaser";
import { NetworkManager } from "../../managers/NetworkManager";
import { EntityManager } from "../../managers/EntityManager";
import { InputManager } from "../../managers/InputManager";
import { PhysicsManager } from "../../managers/PhysicsManager";
import { TimeManager } from "../../managers/TimeManager";
import { SceneManager } from "../../managers/SceneManager";
// Import specific entity types if needed for direct creation (less common here)
// import { Player } from '../entities/Player';
// Import the PlayerInputMessage type from shared
import type { PlayerInputMessage } from "@one-button-to-space/shared";
import type { Player } from "../../entities/Player"; // Import Player type for casting

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

  // Input state tracking
  private playerInputSequence: number = 0;
  private wasThrusting: boolean = false;
  private readonly rotationSpeed: number = Math.PI / 2; // Radians per second (adjust as needed)

  // Scene-specific properties
  // private map: Phaser.Tilemaps.Tilemap | null = null;

  constructor() {
    super("GameScene");
  }

  init(/*data?: object*/): void {
    console.log("GameScene: Init");
    // Initialize managers
    this.networkManager = NetworkManager.getInstance();
    this.entityManager = EntityManager.getInstance();
    this.inputManager = InputManager.getInstance();
    this.physicsManager = PhysicsManager.getInstance();
    this.timeManager = TimeManager.getInstance();
    this.sceneManager = SceneManager.getInstance(this.game);

    // Set scene context for managers that need it
    this.timeManager.setSceneContext(this);
    this.physicsManager.setSceneContext(this);
    this.inputManager.setSceneContext(this);
    // EntityManager context is set AFTER we receive the sessionId from the server
  }

  preload(): void {
    console.log("GameScene: Preload");
    // Assets should ideally be preloaded in BootScene or a dedicated PreloadScene
    // Only load assets here if they are specific to *just* this scene and not needed before
  }

  async create(/*data?: object*/): Promise<void> {
    console.log("GameScene: Create");

    // --- Setup Physics --- (Example: world bounds)
    // Since it's top-down and server-auth, bounds might be less critical or handled server-side
    // this.matter.world.setBounds(0, 0, 1600, 1200);

    // --- Setup Input --- (Register keys needed)
    this.inputManager.registerKeys([
      "W", // Thrust
      "A", // Rotate Left
      "S", // (Not used for server input currently)
      "D", // Rotate Right
      "SPACE", // (Not used for server input currently)
      "UP", // Thrust Alt
      "LEFT", // Rotate Left Alt
      "DOWN", // (Not used for server input currently)
      "RIGHT", // Rotate Right Alt
    ]);

    // --- Connect to Server ---
    try {
      // TODO: Replace 'my_room' and provide actual player options from UI/storage
      const playerName = "Player_" + Math.floor(Math.random() * 1000);
      const room = await this.networkManager.connect("game_room", {
        playerName,
      });

      if (room && room.sessionId) {
        console.log(
          `GameScene: Connected to room ${room.roomId} with session ID ${room.sessionId}`
        );
        // NOW set the EntityManager context with the correct session ID
        this.entityManager.setSceneContext(this, room.sessionId);
        // Initial state sync will be triggered by NetworkManager listener
      } else {
        console.error(
          "GameScene: Failed to connect or get session ID after connection attempt."
        );
        this.handleConnectionError("Connection failed or session ID missing.");
      }
    } catch (error: any) {
      console.error("GameScene: Error connecting to server:", error);
      this.handleConnectionError(error.message || "Unknown connection error");
    }

    // --- Debug --- (Optional: Display FPS)
    if (import.meta.env.DEV) {
      this.createDebugInfo();
    }

    // Example: Add a simple background or tilemap
    // this.add.image(0, 0, 'background').setOrigin(0);
    // this.map = this.make.tilemap({ key: 'map' });
    // const tileset = this.map.addTilesetImage('my_tileset', 'tiles');
    // this.map.createLayer('Ground', tileset);
    // this.map.createLayer('Walls', tileset).setCollisionByProperty({ collides: true });
    // this.matter.world.convertTilemapLayer(this.map.getLayer('Walls').tilemapLayer);

    // Add listener for window resize
    this.scale.on("resize", this.onResize, this);
  }

  update(time: number, delta: number): void {
    // --- Input Handling --- // Call the new method
    this.processAndSendInput(delta);

    // --- Entity Updates --- (Handled by Phaser loop + updateFromServer)

    // --- Manager Updates --- (If needed)
  }

  /**
   * Process player input and send relevant messages to the server.
   * @param delta - Time elapsed since the last frame in milliseconds.
   */
  processAndSendInput(delta: number): void {
    if (!this.networkManager.isConnected()) return;

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
      // console.log("Sent: thrust_start");
    } else if (!isThrusting && this.wasThrusting) {
      // Stopped thrusting
      this.playerInputSequence++;
      const inputMsg: PlayerInputMessage = {
        seq: this.playerInputSequence,
        input: "thrust_stop",
      };
      this.networkManager.sendMessage("playerInput", inputMsg);
      // console.log("Sent: thrust_stop");
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

        // Send angle update to server
        this.playerInputSequence++;
        const inputMsg: PlayerInputMessage = {
          seq: this.playerInputSequence,
          input: "set_angle",
          value: targetAngle,
        };
        this.networkManager.sendMessage("playerInput", inputMsg);
        // console.log("Sent: set_angle", targetAngle.toFixed(2));

        // Optional: Client-side prediction - apply rotation visually immediately
        // player.setRotation(targetAngle);
      }
    }

    // --- Action Input (Example - Not implemented for server yet) --- //
    // const actionPressed = this.inputManager.isKeyJustDown("SPACE");
    // if (actionPressed) {
    //   this.playerInputSequence++;
    //   const inputMsg = { seq: this.playerInputSequence, input: "action_fire" }; // Define message type
    //   this.networkManager.sendMessage("playerInput", inputMsg);
    // }
  }

  createDebugInfo(): void {
    const debugInfo = [
      `Phaser: ${Phaser.VERSION}`,
      `FPS: ${this.timeManager.fps.toFixed(2)}`,
      `Entities: ${this.entityManager.getAllEntities().size}`,
      `Player ID: ${this.networkManager.sessionId || "N/A"}`,
    ];

    const debugText = this.add.text(10, 10, debugInfo, {
      font: "14px Arial",
      color: "#00ff00",
      backgroundColor: "rgba(0,0,0,0.5)",
      padding: { x: 5, y: 5 },
    });
    debugText.setScrollFactor(0); // Keep debug info fixed

    this.timeManager.addLoop(500, () => {
      debugInfo[1] = `FPS: ${this.timeManager.fps.toFixed(2)}`;
      debugInfo[2] = `Entities: ${this.entityManager.getAllEntities().size}`;
      debugInfo[3] = `Player ID: ${this.networkManager.sessionId || "N/A"}`;
      debugText.setText(debugInfo);
    });
  }

  handleConnectionError(message: string): void {
    console.error(`Connection Error: ${message}`);
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
    console.log(`Resized to: ${gameSize.width}x${gameSize.height}`);
  }

  shutdown(): void {
    console.log("GameScene: Shutdown");
    // Clean up scene-specific resources and listeners
    this.scale.off("resize", this.onResize, this);
    // Managers are typically destroyed globally or when the game instance is destroyed,
    // but if a manager holds scene-specific resources, clean them here.
    // this.entityManager.clearSceneSpecificData(); // Example

    // Attempt to disconnect if the network manager still exists
    if (this.networkManager && this.networkManager.isConnected()) {
      this.networkManager.disconnect();
    }
  }
}
