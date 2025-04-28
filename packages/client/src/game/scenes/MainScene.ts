import Phaser from "phaser";
import { PhysicsManager } from "../physics/PhysicsManager"; // Corrected relative path
import { Rocket } from "../entities/Rocket"; // Correct relative path & Removed interface import
// Use Phaser's Matter Body type and Matter Composite for removal
import { Composite as MatterComposite } from "matter-js"; // Keep for Composite
import { DeviceOrientationManager } from "../../utils/DeviceOrientationManager"; // Correct relative path
import { CollisionCategory } from "@one-button-to-space/shared"; // Import shared categories
import { ZoomController } from "../controllers/ZoomController";
// Multiplayer Imports
import {
  MultiplayerService,
  multiplayerService,
  ConnectionStatus, // Removed 'type' keyword
  type PhysicsUpdateListener, // Explicitly import as type
} from "../../services/MultiplayerService"; // Adjust path as needed, import instance
import { PlayerState, PlanetData } from "../../schema/State"; // Adjust path, ADD PlanetData
// Import PlayerInputMessage from shared types
import { PlayerInputMessage } from "@one-button-to-space/shared"; // Corrected import path
// Import matter-js to make MatterJS global namespace available
// import "matter-js";
// Use direct import for Body
import { Body as MatterBody } from "matter-js";
import { Planet, PlanetConfig } from "../entities/Planet"; // Import Planet and PlanetConfig
import { Logger, LogLevel } from "@one-button-to-space/shared"; // Updated path
import { DebugHud } from "../../ui/DebugHud"; // Import the new HUD class
import {
  Constants, // Import the new constant
} from "@one-button-to-space/shared"; // Import shared constant
// Import Starfield classes
import { StarField } from "../effects/StarField";
import { StarFieldRenderer } from "../effects/StarFieldRenderer";
// Import shared physics logic using relative path
import { PhysicsLogic } from "@one-button-to-space/shared";
import { TimeManager } from "../core/TimeManager"; // Existing import

// --- Import Custom ECS Core ---
import { GameObject } from "../core/GameObject";
import { SpriteRenderer } from "../components/SpriteRenderer";
import { PhysicsBody } from "../components/PhysicsBody"; // Import PhysicsBody

// --- Constants ---
const {
  CLIENT_PHYSICS_CORRECTION_FACTOR,
  CLIENT_POSITION_CORRECTION_THRESHOLD,
  CLIENT_VELOCITY_CORRECTION_THRESHOLD,
  CLIENT_ANGLE_CORRECTION_THRESHOLD,
} = Constants;

const LOGGER_SOURCE = "🎬🌟"; // Chosen emojis for MainScene
const STATE_SEND_INTERVAL_MS = 100; // Send state 10 times per second

export class MainScene extends Phaser.Scene {
  // --- Physics ---
  private sceneRoot!: GameObject;
  private physicsManagerComponent!: PhysicsManager;
  private timeManager!: TimeManager;

  // --- Entities ---
  private rocket: Rocket | undefined = undefined;
  private planetObjects: Map<string, Planet> = new Map();

  // --- Effects ---
  private starfield!: StarField;
  private starfieldRenderer!: StarFieldRenderer;

  // --- Controllers ---
  private zoomController!: ZoomController;

  // --- Input ---
  private thrustKey!: Phaser.Input.Keyboard.Key;
  private isPointerDown: boolean = false;
  private isLocalThrusting: boolean = false;
  private orientationManager!: DeviceOrientationManager;
  private inputSequenceNumber: number = 0;

  // --- Multiplayer ---
  private multiplayerService!: MultiplayerService;
  private remotePlayers: Map<string, Rocket> = new Map();
  private lastStateSendTime: number = 0;
  private readonly stateSendInterval: number = STATE_SEND_INTERVAL_MS;
  private localPlayerId: string | null = null;

  // --- UI ---
  private connectionStatusText!: Phaser.GameObjects.Text;
  private debugHud!: DebugHud;

  // --- New Member Variables ---
  private lastSentAngle: number | undefined = undefined;

  // --- Custom ECS Management ---
  private managedGameObjects: Map<number, GameObject> = new Map();

  constructor() {
    super({ key: "MainScene" });
    Logger.debug(LOGGER_SOURCE, "MainScene constructor called");
    this.sceneRoot = new GameObject(this, "SceneRoot");
  }

  preload(): void {
    Logger.debug(LOGGER_SOURCE, "MainScene preload called");
    // Load the new rocket image
    this.load.image("rocket", "assets/images/rocket.png");
    // Load the thruster images
    this.load.image("thruster_001", "assets/images/thruster_001.png");
    this.load.image("thruster_002", "assets/images/thruster_002.png");
    Logger.info(LOGGER_SOURCE, "Loaded rocket and thruster assets.");
  }

  create(): void {
    Logger.debug(LOGGER_SOURCE, "MainScene create called");

    this.attemptScreenLock();
    this.setupTiming();
    this.setupPhysics();
    this.setupCamera();
    this.createEntities();
    this.setupControllers();
    this.initializeMultiplayer();
    this.setupInput();
    this.setupOrientation();
    this.createUI();
    this.setupCollisions();

    // --- Call Awake & Start on Custom GameObjects ---
    Logger.info(
      LOGGER_SOURCE,
      "Calling _internalAwake on managed GameObjects..."
    );
    this.managedGameObjects.forEach((go) => {
      if (go.active && !go.isAwake) {
        go._internalAwake();
      }
    });
    Logger.info(
      LOGGER_SOURCE,
      "Calling _internalStart on managed GameObjects..."
    );
    this.managedGameObjects.forEach((go) => {
      if (go.active && go.isAwake && !go.isStarted) {
        go._internalStart();
      }
    });
    Logger.info(LOGGER_SOURCE, "GameObject awake/start complete.");
    // ---------------------------------------------
  }

  update(time: number, delta: number): void {
    // --- Update Time Manager FIRST ---
    this.timeManager.update(time);

    // --- Custom ECS Variable Update ---
    Logger.trace(LOGGER_SOURCE, "Update loop start");

    this.managedGameObjects.forEach((go) => {
      if (go.active && go.isStarted) {
        go._internalUpdate(this.timeManager.deltaTimeS);
      }
    });
    // -----------------------------------

    const targetAngleRad =
      this.orientationManager.getTargetRocketAngleRadians();

    if (!this.physicsManagerComponent) {
      Logger.error(
        LOGGER_SOURCE,
        "PhysicsManagerComponent not initialized in update."
      );
      return;
    }

    this.handleAndSendInput(targetAngleRad);

    // --- Variable Update / Rendering ---
    const alpha = this.timeManager.interpolationAlpha;

    const localRocket = this.findLocalPlayerRocket();

    this.updateUIElements(this.timeManager.currentFps, localRocket);

    this.updateControllers(this.timeManager.deltaTimeS);

    this.updateEffects(
      this.timeManager.totalElapsedTimeS,
      this.timeManager.deltaTimeS
    );
  }

  shutdown(): void {
    Logger.info(LOGGER_SOURCE, "MainScene shutting down...");

    // --- Destroy Custom GameObjects ---
    this.managedGameObjects.forEach((go) => {
      if (go.active && !go.isDestroyed) {
        go.destroy();
      }
    });
    this.managedGameObjects.clear();
    Logger.info(LOGGER_SOURCE, "Destroyed SceneRoot and managed GameObjects.");
    // ----------------------------------

    this.shutdownMultiplayer();
    this.shutdownControllers();
    this.shutdownOrientation();
    this.shutdownUI();
    this.shutdownEffects();

    // Unhook matterupdate listener (still needed for Matter internal stepping? Check Phaser docs)
    // Let's keep it off for now as we drive updates via processFixedUpdates
    // this.matter.world.off("matterupdate", this.matterFixedUpdate, this);

    Logger.info(LOGGER_SOURCE, "MainScene shutdown complete.");
  }

  // --- Initialization Helpers (Called from create) ---

  private attemptScreenLock(): void {
    if (
      screen.orientation &&
      typeof (screen.orientation as any).lock === "function"
    ) {
      (screen.orientation as any)
        .lock("portrait")
        .then(() => {
          Logger.info(LOGGER_SOURCE, "Screen orientation locked to portrait.");
        })
        .catch((error: Error) => {
          Logger.warn(
            LOGGER_SOURCE,
            "Screen orientation lock failed:",
            error.message
          );
        });
    } else {
      Logger.warn(
        LOGGER_SOURCE,
        "Screen Orientation API lock() not supported."
      );
    }
  }

  private setupTiming(): void {
    this.timeManager = new TimeManager();
    Logger.info(LOGGER_SOURCE, "TimeManager initialized for scene.");
  }

  private setupPhysics(): void {
    this.physicsManagerComponent = this.sceneRoot.addComponent(
      new PhysicsManager()
    );
    if (!this.physicsManagerComponent) {
      Logger.error(LOGGER_SOURCE, "Failed to add PhysicsManager component!");
      return;
    }
    // REMOVE hooking into Matter's fixed update event here
    // this.matter.world.on("matterupdate", this.matterFixedUpdate, this);
    Logger.info(LOGGER_SOURCE, "PhysicsManager component added to SceneRoot."); // Removed hook mention
  }

  private setupCamera(): void {
    this.cameras.main.setBackgroundColor("#000000"); // Black for space
    Logger.info(LOGGER_SOURCE, "Camera background set.");
  }

  private createEntities(): void {
    Logger.info(LOGGER_SOURCE, "Setting up entity placeholders...");
    // Local Rocket creation is now deferred until the first server state update.
    // Camera follow is also deferred.

    // --- Create Background Effects ---
    this.starfield = new StarField({
      seed: 12345, // Use a fixed seed for consistency during testing
      density: 800, // Slightly denser field
      minSize: 0.5,
      maxSize: 1.5,
      enableTwinkling: true,
      twinkleSpeed: 0.05,
      colorVariations: true,
    });
    this.starfieldRenderer = new StarFieldRenderer(this, this.starfield, {
      depth: -100,
      backgroundColor: null,
    });
    Logger.info(LOGGER_SOURCE, "Starfield and renderer created.");
  }

  private setupControllers(): void {
    this.zoomController = new ZoomController(this);
    Logger.info(LOGGER_SOURCE, "ZoomController initialized.");
  }

  private initializeMultiplayer(): void {
    Logger.info(LOGGER_SOURCE, "Initializing MultiplayerService...");
    this.multiplayerService = multiplayerService;

    this.multiplayerService.addPlayerAddListener(this.handlePlayerAdd);
    this.multiplayerService.addPhysicsUpdateListener(
      this.handlePhysicsUpdate.bind(this)
    );
    this.multiplayerService.addPlayerRemoveListener(this.handlePlayerRemove);
    this.multiplayerService.addStatusListener(
      this.handleConnectionStatusChange.bind(this)
    );
    this.multiplayerService.addPlanetAddListener(this.handlePlanetAdd);
    this.multiplayerService.addPlanetRemoveListener(this.handlePlanetRemove);

    try {
      this.multiplayerService.connect();
      Logger.info(
        LOGGER_SOURCE,
        "Attempting to connect to multiplayer server..."
      );
    } catch (error) {
      Logger.error(
        LOGGER_SOURCE,
        "Failed to initiate multiplayer connection:",
        error
      );
      this.handleConnectionStatusChange(ConnectionStatus.Disconnected);
    }
  }

  private setupInput(): void {
    Logger.info(LOGGER_SOURCE, "Setting up input listeners...");
    const angleSendThreshold = 0.05; // Radians, ~3 degrees. Adjust as needed.

    // Keyboard Thrust
    if (this.input.keyboard) {
      this.thrustKey = this.input.keyboard.addKey(
        Phaser.Input.Keyboard.KeyCodes.SPACE
      );

      // Listen for key down to send 'thrust_start'
      this.thrustKey.on("down", () => {
        if (!this.isLocalThrusting) {
          // Only trigger on first press
          this.isLocalThrusting = true;
        }
        this.sendInput("thrust_start");
        Logger.info(LOGGER_SOURCE, "Keyboard thrust started.");
      });

      // Listen for key up to send 'thrust_stop'
      this.thrustKey.on("up", () => {
        if (this.isLocalThrusting) {
          // Only trigger on release
          this.isLocalThrusting = false;
        }
        this.sendInput("thrust_stop");
        Logger.info(LOGGER_SOURCE, "Keyboard thrust stopped.");
      });

      Logger.info(LOGGER_SOURCE, "SPACE key registered for thrust start/stop.");
    } else {
      Logger.error(
        LOGGER_SOURCE,
        "Keyboard input not available in this scene."
      );
    }

    // Pointer (Touch/Mouse) Thrust
    this.input.on("pointerdown", () => {
      if (!this.isPointerDown) {
        // Only send on initial press
        this.isPointerDown = true;
        this.isLocalThrusting = true; // Start local thrust prediction
        this.sendInput("thrust_start");
        Logger.info(LOGGER_SOURCE, "Pointer thrust started.");
      }
    });
    this.input.on("pointerup", () => {
      if (this.isPointerDown) {
        // Only send on release
        this.isPointerDown = false;
        this.isLocalThrusting = false; // Stop local thrust prediction
        this.sendInput("thrust_stop");
        Logger.info(LOGGER_SOURCE, "Pointer thrust stopped.");
      }
    });
    this.input.on("gameout", () => {
      if (this.isPointerDown) {
        // Handle pointer leaving the game area
        this.isPointerDown = false;
        this.isLocalThrusting = false; // Stop local thrust prediction
        this.sendInput("thrust_stop");
        Logger.info(LOGGER_SOURCE, "Pointer left game area, stopping thrust.");
      }
    });

    // Pointer Move for Tilt Simulation (Keep as is, sets simulated orientation)
    this.input.on(
      "pointermove",
      (pointer: Phaser.Input.Pointer) => {
        if (this.orientationManager) {
          const gameWidth = this.scale.width;
          const targetAngleRad = Phaser.Math.Linear(
            -Math.PI,
            Math.PI,
            pointer.x / gameWidth
          );
          // Set simulated gamma based on pointer - this will be read later in update
          this.orientationManager.setSimulatedOrientation(
            null,
            Phaser.Math.RadToDeg(targetAngleRad)
          );
          Logger.trace(
            LOGGER_SOURCE,
            `Pointer Move: Set simulated gamma for angle=${targetAngleRad.toFixed(
              2
            )}`
          ); // Less verbose
        }
      },
      this
    );
  }

  private setupOrientation(): void {
    this.orientationManager = new DeviceOrientationManager();
    this.orientationManager.startListening();
    Logger.info(LOGGER_SOURCE, "DeviceOrientationManager started.");
  }

  private createUI(): void {
    Logger.info(LOGGER_SOURCE, "Creating UI elements...");
    // Connection Status Text
    this.connectionStatusText = this.add
      .text(10, 10, "Status: Initializing...", {
        fontSize: "16px",
        color: "#ffffff",
        backgroundColor: "rgba(0,0,0,0.6)",
        padding: { x: 8, y: 4 },
      })
      .setScrollFactor(0)
      .setDepth(100); // Ensure on top

    // Debug HUD
    this.debugHud = new DebugHud(this, 10, 40); // Below status text
    Logger.info(LOGGER_SOURCE, "UI elements created.");
  }

  private setupCollisions(): void {
    Logger.info(LOGGER_SOURCE, "Setting up collision listeners...");
    this.matter.world.on(
      "collisionstart",
      (event: Phaser.Physics.Matter.Events.CollisionStartEvent) => {
        this.handleCollisionStart(event);
      }
    );
  }

  // --- Update Helpers (Called from update) ---

  private handleInputAndUpdateRocket(time: number, delta: number): void {
    // This function is now largely empty. Input is handled in update via handleAndSendInput.
    // Visual updates happen in Rocket.update() called from the main update loop.
  }

  private updateControllers(deltaTimeS: number): void {
    this.zoomController.update(deltaTimeS);
  }

  private updateMultiplayerState(time: number): void {
    // This function might become redundant or repurposed if input is sent immediately
    // Keep for now, maybe needed for other state later.
    // if (time > this.lastStateSendTime + this.stateSendInterval) {
    //   if (this.rocket && this.multiplayerService) {
    //     const localState: Partial<PlayerState> = {
    //       x: this.rocket.body.position.x,
    //       y: this.rocket.body.position.y,
    //       angle: this.rocket.body.angle,
    //       // cargo: this.rocket.getCargoState(), // If applicable
    //     };
    //     this.multiplayerService.sendPlayerState(localState); // This method was for sending STATE, not input
    //     this.lastStateSendTime = time;
    //   }
    // }
  }

  private updateUIElements(
    currentFps: number,
    localRocket: Rocket | null
  ): void {
    if (localRocket) {
      const physicsBodyComp = localRocket.getComponent(PhysicsBody);
      if (physicsBodyComp?.body && this.debugHud) {
        const pos = physicsBodyComp.body.position;
        const vel = physicsBodyComp.body.velocity;
        const speed = Math.sqrt(vel.x * vel.x + vel.y * vel.y);
        const angleDeg = Phaser.Math.RadToDeg(physicsBodyComp.body.angle);

        const planetDataForDensity = this.findPlanetsForDensityCalc();
        const density = PhysicsLogic.calculateDensityAt(
          pos,
          planetDataForDensity
        );

        const fps = this.game.loop.actualFps;
        const mps = this.multiplayerService?.getMps() ?? 0;
        const omps = this.multiplayerService?.getOmps() ?? 0;
        const rtt = this.multiplayerService?.getRtt() ?? 0;

        const hudData = {
          posX: pos.x,
          posY: pos.y,
          velX: vel.x,
          velY: vel.y,
          speed: speed,
          angleDeg: angleDeg,
          density: density,
          currentTimeString: Logger.getCurrentTimestampString(),
          fps: fps,
          ups: this.timeManager.currentUps,
          mps: mps,
          omps: omps,
          rtt: rtt,
        };
        this.debugHud.update(hudData);
      }
    } else {
      // Optionally clear HUD if local rocket doesn't exist
      // this.debugHud.clear();
    }

    // Update Connection Status Text
    let text = "Status: Initializing...";
    let color = "#ffffff"; // Default white

    if (this.multiplayerService) {
      switch (this.multiplayerService.getConnectionStatus()) {
        case "connected":
          color = "#00ff00"; // Green
          text = `Status: Connected (ID: ${this.localPlayerId})`;
          break;
        case "connecting":
          color = "#ffff00"; // Yellow
          break;
        case "disconnected":
          color = "#ff0000"; // Red
          text = "Status: Disconnected";
          this.cleanupMultiplayerEntities(); // Clear visuals on disconnect
          break;
        case "error":
          color = "#ff0000"; // Red
          text = "Status: Error";
          this.cleanupMultiplayerEntities(); // Also clear on error
          break;
      }
    }

    if (this.connectionStatusText) {
      this.connectionStatusText.setText(text);
      this.connectionStatusText.setColor(color);
    }
  }

  private updateEffects(time: number, delta: number): void {
    if (this.starfieldRenderer) {
      this.starfieldRenderer.update(time, delta);
    }
  }

  // --- Collision Handling ---

  private handleCollisionStart(
    event: Phaser.Physics.Matter.Events.CollisionStartEvent
  ): void {
    for (const pair of event.pairs) {
      const { bodyA, bodyB } = pair;

      const goA = this.findGameObjectByBodyId(bodyA.id);
      const goB = this.findGameObjectByBodyId(bodyB.id);

      if (!goA || !goB) continue;

      const rocket =
        goA instanceof Rocket ? goA : goB instanceof Rocket ? goB : null;
      const planet =
        goA instanceof Planet ? goA : goB instanceof Planet ? goB : null;

      if (rocket && planet) {
        Logger.info(
          LOGGER_SOURCE,
          `Collision detected between: rocket '${rocket.ownerId}' and planet '${planet.config.id}'`
        );
        continue;
      }

      const rocketA = goA instanceof Rocket ? goA : null;
      const rocketB = goB instanceof Rocket ? goB : null;

      if (rocketA && rocketB) {
        Logger.info(
          LOGGER_SOURCE,
          `Rocket-Rocket Collision Event: '${rocketA.ownerId}' vs '${rocketB.ownerId}'`
        );
        const bodyCompA = rocketA.getComponent(PhysicsBody);
        const bodyCompB = rocketB.getComponent(PhysicsBody);
        continue;
      }
    }
  }

  // --- Multiplayer Event Handlers ---

  private handlePlayerAdd = (
    playerId: string,
    playerState: PlayerState
  ): void => {
    Logger.debug(LOGGER_SOURCE, `handlePlayerAdd for player: ${playerId}`);
    const currentLocalId = this.multiplayerService?.getSessionId();
    this.localPlayerId = currentLocalId ?? null;

    if (this.findGameObjectByName(`Rocket_${playerId}`)) {
      Logger.warn(
        LOGGER_SOURCE,
        `GameObject for player ${playerId} already exists. Ignoring add event.`
      );
      return;
    }

    Logger.info(
      LOGGER_SOURCE,
      `Creating GameObject for player ${playerId} at (${playerState.x.toFixed(
        1
      )}, ${playerState.y.toFixed(1)})`
    );

    const newRocket = new Rocket(
      this,
      playerState.x,
      playerState.y,
      playerId,
      playerState.angle
    );

    if (this.sceneRoot.isAwake) {
      newRocket._internalAwake();
    }
    if (this.sceneRoot.isStarted) {
      newRocket._internalStart();
    }

    if (playerId === this.localPlayerId) {
      Logger.info(
        LOGGER_SOURCE,
        "Setting camera to follow local player rocket GameObject."
      );
      this.cameras.main.startFollow(newRocket);
      this.localPlayerId = playerId;
    }
  };

  private handlePhysicsUpdate(updateData: {
    [sessionId: string]: Partial<PlayerState>;
  }): void {
    for (const sessionId in updateData) {
      const state = updateData[sessionId];
      const targetGameObject = this.findGameObjectByName(`Rocket_${sessionId}`);
      const targetRocket =
        targetGameObject instanceof Rocket ? targetGameObject : null;

      if (!targetRocket) {
        Logger.warn(
          LOGGER_SOURCE,
          `handlePhysicsUpdate: Received state for unknown/uncreated rocket: ${sessionId}`
        );
        continue;
      }

      const physicsBodyComp = targetRocket.getComponent(PhysicsBody);
      if (!physicsBodyComp?.body) {
        Logger.warn(
          LOGGER_SOURCE,
          `handlePhysicsUpdate: Rocket ${sessionId} has no PhysicsBody component or body.`
        );
        continue;
      }

      const currentBody = physicsBodyComp.body;
      const correctionFactor = CLIENT_PHYSICS_CORRECTION_FACTOR;

      if (sessionId === this.localPlayerId) {
        if (typeof state?.x === "number" || typeof state?.y === "number") {
          const currentPos = currentBody.position;
          const serverX = state.x ?? currentPos.x;
          const serverY = state.y ?? currentPos.y;
          const diffX = Math.abs(currentPos.x - serverX);
          const diffY = Math.abs(currentPos.y - serverY);

          if (
            diffX > CLIENT_POSITION_CORRECTION_THRESHOLD ||
            diffY > CLIENT_POSITION_CORRECTION_THRESHOLD
          ) {
            const correctedPosX = Phaser.Math.Linear(
              currentPos.x,
              serverX,
              correctionFactor
            );
            const correctedPosY = Phaser.Math.Linear(
              currentPos.y,
              serverY,
              correctionFactor
            );
            MatterBody.setPosition(currentBody, {
              x: correctedPosX,
              y: correctedPosY,
            });
          }
        }
        if (typeof state?.vx === "number" || typeof state?.vy === "number") {
          const currentVel = currentBody.velocity;
          const serverVx = state.vx ?? currentVel.x;
          const serverVy = state.vy ?? currentVel.y;
          const diffVx = Math.abs(currentVel.x - serverVx);
          const diffVy = Math.abs(currentVel.y - serverVy);
          if (
            diffVx > CLIENT_VELOCITY_CORRECTION_THRESHOLD ||
            diffVy > CLIENT_VELOCITY_CORRECTION_THRESHOLD
          ) {
            const correctedVelX = Phaser.Math.Linear(
              currentVel.x,
              serverVx,
              correctionFactor
            );
            const correctedVelY = Phaser.Math.Linear(
              currentVel.y,
              serverVy,
              correctionFactor
            );
            MatterBody.setVelocity(currentBody, {
              x: correctedVelX,
              y: correctedVelY,
            });
          }
        }
        if (typeof state?.angle === "number") {
          const currentAngle = currentBody.angle;
          const serverAngle = state.angle;
          const diffAngle = Phaser.Math.Angle.ShortestBetween(
            Phaser.Math.RadToDeg(currentAngle),
            Phaser.Math.RadToDeg(serverAngle)
          );
          if (
            Math.abs(Phaser.Math.DegToRad(diffAngle)) >
            CLIENT_ANGLE_CORRECTION_THRESHOLD
          ) {
            const correctedAngle = Phaser.Math.Angle.RotateTo(
              currentAngle,
              serverAngle,
              correctionFactor
            );
            MatterBody.setAngle(currentBody, correctedAngle);
          }
        }
        if (typeof state?.isThrusting === "boolean") {
          targetRocket.isThrusting = state.isThrusting;
        }
      } else {
        if (typeof state?.x === "number" && typeof state?.y === "number") {
          MatterBody.setPosition(currentBody, { x: state.x, y: state.y });
        }
        if (typeof state?.angle === "number") {
          MatterBody.setAngle(currentBody, state.angle);
        }
        if (typeof state?.isThrusting === "boolean") {
          targetRocket.isThrusting = state.isThrusting;
        }
      }
    }
  }

  private handlePlayerRemove = (playerId: string): void => {
    Logger.info(LOGGER_SOURCE, `Handling remove for player ${playerId}`);
    const playerGameObject = this.findGameObjectByName(`Rocket_${playerId}`);
    if (playerGameObject) {
      Logger.info(
        LOGGER_SOURCE,
        `Destroying GameObject for removed player ${playerId}`
      );
      playerGameObject.destroy();
    } else {
      Logger.warn(
        LOGGER_SOURCE,
        `GameObject for player ${playerId} not found for removal.`
      );
    }
    if (playerId === this.localPlayerId) {
      this.localPlayerId = null;
    }
  };

  private handleConnectionStatusChange(status: ConnectionStatus): void {
    Logger.info(LOGGER_SOURCE, `Connection status changed: ${status}`);
    let text = `Status: ${status}`;
    let color = "#ffffff";
    if (status === "connected") {
      color = "#00ff00";
      this.localPlayerId = this.multiplayerService.getSessionId() ?? null;
      text = `Status: Connected (ID: ${this.localPlayerId})`;
    } else if (status === "connecting") {
      color = "#ffff00";
    } else {
      color = "#ff0000";
      this.localPlayerId = null;
      this.cleanupMultiplayerEntities();
      if (status === "error") text = "Status: Error";
      else text = "Status: Disconnected";
    }
    if (this.connectionStatusText) {
      this.connectionStatusText.setText(text);
      this.connectionStatusText.setColor(color);
    }
  }

  // --- Planet Handlers ---

  private handlePlanetAdd = (
    planetId: string,
    planetData: PlanetData & {
      seed: string;
      colors: { base: string; accent1?: string; accent2?: string };
      noiseParams: { scale: number; octaves?: number };
    }
  ): void => {
    Logger.warn(
      LOGGER_SOURCE,
      "handlePlanetAdd needs refactoring for GameObject structure."
    );
  };

  private handlePlanetRemove = (planetId: string): void => {
    Logger.warn(
      LOGGER_SOURCE,
      "handlePlanetRemove needs refactoring for GameObject structure."
    );
  };

  // --- Cleanup Helpers ---

  private cleanupMultiplayerEntities(): void {
    Logger.warn(LOGGER_SOURCE, "Cleaning up multiplayer GameObjects...");
    this.managedGameObjects.forEach((go) => {
      if (go.name.startsWith("Rocket_") || go.name.startsWith("Planet_")) {
        if (go.id !== this.sceneRoot.id) {
          go.destroy();
        }
      }
    });
    Logger.info(LOGGER_SOURCE, "Multiplayer GameObjects cleanup attempted.");
  }

  // --- Shutdown Helpers (Called from shutdown) ---

  private shutdownMultiplayer(): void {
    if (this.multiplayerService) {
      this.multiplayerService.removePlayerRemoveListener(
        this.handlePlayerRemove
      );
      this.multiplayerService.removeStatusListener(
        this.handleConnectionStatusChange
      );
      this.multiplayerService.disconnect();
      Logger.info(LOGGER_SOURCE, "Multiplayer service disconnected.");
    }
    this.cleanupMultiplayerEntities();
  }

  private shutdownControllers(): void {
    this.zoomController?.destroy();
    Logger.info(LOGGER_SOURCE, "ZoomController destroyed.");
  }

  private shutdownOrientation(): void {
    if (this.orientationManager) {
      this.orientationManager.destroy();
      Logger.info(LOGGER_SOURCE, "DeviceOrientationManager destroyed.");
    }
  }

  private shutdownUI(): void {
    if (this.connectionStatusText) {
      this.connectionStatusText.destroy();
      Logger.info(LOGGER_SOURCE, "Connection status text destroyed.");
    }
    if (this.debugHud) {
      this.debugHud.destroy();
      Logger.info(LOGGER_SOURCE, "Debug HUD destroyed.");
    }
  }

  private shutdownEffects(): void {
    this.starfieldRenderer?.destroy();
    Logger.info(LOGGER_SOURCE, "StarfieldRenderer destroyed.");
  }

  // Helper method to send input messages
  private sendInput(
    inputType: PlayerInputMessage["input"],
    value?: number
  ): void {
    if (!this.multiplayerService || !this.multiplayerService.isConnected()) {
      Logger.warn(LOGGER_SOURCE, "Attempted to send input when not connected.");
      return;
    }

    const message: PlayerInputMessage = {
      seq: this.inputSequenceNumber++,
      input: inputType,
      timestamp: Date.now(),
    };
    if (value !== undefined) {
      message.value = value;
    }
    this.multiplayerService.sendPlayerInput(message);
  }

  // New method to consolidate input checking and sending
  private handleAndSendInput(targetAngleRad: number | null): void {
    if (targetAngleRad !== null) {
      const angleSendThreshold = 0.05;
      if (
        this.lastSentAngle === undefined ||
        Math.abs(targetAngleRad - (this.lastSentAngle ?? 0)) >
          angleSendThreshold
      ) {
        this.sendInput("set_angle", targetAngleRad);
        this.lastSentAngle = targetAngleRad;
        Logger.debug(
          LOGGER_SOURCE,
          `Update Loop: Sent set_angle=${targetAngleRad.toFixed(2)}`
        );
      }
    }
  }

  // --- Custom GameObject Management Helpers ---
  public addGameObject(gameObject: GameObject): void {
    if (this.managedGameObjects.has(gameObject.id)) {
      Logger.warn(
        LOGGER_SOURCE,
        `GameObject ${gameObject.name} (ID: ${gameObject.id}) already managed.`
      );
      return;
    }
    this.managedGameObjects.set(gameObject.id, gameObject);
  }

  public removeGameObject(gameObject: GameObject): void {
    this.managedGameObjects.delete(gameObject.id);
  }

  public getGameObjectById(id: number): GameObject | undefined {
    return this.managedGameObjects.get(id);
  }

  public findGameObjectByName(name: string): GameObject | undefined {
    for (const go of this.managedGameObjects.values()) {
      if (go.name === name) {
        return go;
      }
    }
    return undefined;
  }

  public findLocalPlayerRocket(): Rocket | null {
    if (!this.localPlayerId) return null;
    const go = this.findGameObjectByName(`Rocket_${this.localPlayerId}`);
    return go instanceof Rocket ? go : null;
  }

  private findPlanetsForDensityCalc(): any[] {
    const planets: any[] = [];
    this.managedGameObjects.forEach((go) => {
      if (go instanceof Planet) {
        const bodyComp = go.getComponent(PhysicsBody);
        if (bodyComp?.body) {
          planets.push({
            x: bodyComp.body.position.x,
            y: bodyComp.body.position.y,
            radius: go.radius,
            atmosphereHeight: go.atmosphereHeight,
            surfaceDensity: go.surfaceDensity,
          });
        }
      }
    });
    return planets;
  }

  // --- Process Fixed Updates ---
  // Pass the internal fixed update logic as a callback
  private runFixedUpdateStep(fixedDeltaTimeS: number): void {
    // Apply gravity/forces via PhysicsManager component
    if (this.physicsManagerComponent) {
      this.physicsManagerComponent.fixedUpdate(fixedDeltaTimeS);
    }

    // --- Custom ECS Fixed Update ---
    this.managedGameObjects.forEach((go) => {
      if (go.active && go.isStarted) {
        go._internalFixedUpdate(fixedDeltaTimeS);
      }
    });
    // -----------------------------
  }

  private findGameObjectByBodyId(id: number): GameObject | undefined {
    for (const go of this.managedGameObjects.values()) {
      const physicsBodyComp = go.getComponent(PhysicsBody);
      if (physicsBodyComp?.body && physicsBodyComp.body.id === id) {
        return go;
      }
    }
    return undefined;
  }
}
