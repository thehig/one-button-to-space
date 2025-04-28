import Phaser from "phaser";
import { NetworkManager } from "../../managers/NetworkManager";
import { EntityManager } from "../../managers/EntityManager";
import { InputManager } from "../../managers/InputManager";
import { PhysicsManager } from "../../managers/PhysicsManager";
import { TimeManager } from "../../managers/TimeManager";
import { SceneManager } from "../../managers/SceneManager";
// Import specific entity types if needed for direct creation (less common here)
// import { Player } from '../entities/Player';

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

    // --- Setup Input --- (Register keys needed for this scene)
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
    // --- Input Handling ---
    this.sendPlayerInput();

    // --- Entity Updates ---
    // Client-side prediction/interpolation happens within individual entity `update` methods,
    // called automatically by Phaser's update loop for sprites.

    // --- Manager Updates ---
    // Call manager updates if they have per-frame logic
    // this.entityManager.update(time, delta);
  }

  sendPlayerInput(): void {
    if (!this.networkManager.isConnected()) return;

    const inputPayload = {
      up: this.inputManager.isKeyDown("W") || this.inputManager.isKeyDown("UP"),
      down:
        this.inputManager.isKeyDown("S") || this.inputManager.isKeyDown("DOWN"),
      left:
        this.inputManager.isKeyDown("A") || this.inputManager.isKeyDown("LEFT"),
      right:
        this.inputManager.isKeyDown("D") ||
        this.inputManager.isKeyDown("RIGHT"),
      action: this.inputManager.isKeyJustDown("SPACE"), // Send only when just pressed
    };

    // TODO: Implement more sophisticated input handling:
    // - Detect changes in input state to avoid sending redundant data.
    // - Potentially queue inputs and send at a fixed rate.
    // - Include sequence numbers for server-side reconciliation.

    this.networkManager.sendMessage("playerInput", inputPayload);
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
