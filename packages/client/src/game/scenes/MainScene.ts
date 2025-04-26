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
  ConnectionStatus,
  PhysicsUpdateListener,
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
const { PLAYER_THRUST_FORCE, CLIENT_PHYSICS_CORRECTION_FACTOR } = Constants;
// Import shared physics logic using relative path
import { PhysicsLogic } from "@one-button-to-space/shared";

// --- Constants ---
const LOGGER_SOURCE = "🎬🌟"; // Chosen emojis for MainScene
const STATE_SEND_INTERVAL_MS = 100; // Send state 10 times per second

export class MainScene extends Phaser.Scene {
  // --- Physics ---
  private physicsManager!: PhysicsManager;

  // --- Entities ---
  private rocket: Rocket | undefined = undefined;
  private planetObjects: Map<string, Planet> = new Map();

  // --- Controllers ---
  private zoomController!: ZoomController;

  // --- Input ---
  private thrustKey!: Phaser.Input.Keyboard.Key;
  private isPointerDown: boolean = false;
  private isLocalThrusting: boolean = false; // Add flag for local thrust prediction
  private orientationManager!: DeviceOrientationManager;
  private inputSequenceNumber: number = 0; // Add sequence number counter

  // --- Multiplayer ---
  private multiplayerService!: MultiplayerService;
  private remotePlayers: Map<string, Rocket> = new Map();
  private lastStateSendTime: number = 0;
  private readonly stateSendInterval: number = STATE_SEND_INTERVAL_MS;

  // --- UI ---
  private connectionStatusText!: Phaser.GameObjects.Text;
  private debugHud!: DebugHud;

  // --- New Member Variables ---
  private lastSentAngle: number | undefined = undefined;

  constructor() {
    super({ key: "MainScene" });
    Logger.debug(LOGGER_SOURCE, "MainScene constructor called");
  }

  preload(): void {
    Logger.debug(LOGGER_SOURCE, "MainScene preload called");
    // Load the new rocket image
    this.load.image("rocket", "assets/images/rocket.png");
    Logger.info(LOGGER_SOURCE, "Loaded rocket asset.");
  }

  create(): void {
    Logger.debug(LOGGER_SOURCE, "MainScene create called");

    this.attemptScreenLock();
    this.setupPhysics();
    this.setupCamera();
    this.createEntities();
    this.setupControllers();
    this.initializeMultiplayer(); // Needs to happen before planet map is passed
    this.setupInput();
    this.setupOrientation();
    this.createUI();
    this.setupCollisions();

    // Initial pass of planet map after multiplayer might have added some
    this.physicsManager.setPlanetObjectsMap(this.planetObjects);
  }

  update(time: number, delta: number): void {
    // Get latest orientation state before input handling
    const targetAngleRad =
      this.orientationManager.getTargetRocketAngleRadians();

    if (!this.physicsManager) {
      Logger.error(LOGGER_SOURCE, "PhysicsManager not initialized in update.");
      return;
    }

    // --- Apply Local Predicted Input Forces (BEFORE physics step/server correction) ---
    /* // REMOVED: Local force application to prevent judder
    if (this.isLocalThrusting && this.rocket?.body) {
      const localBody = this.rocket.body;
      // Use body angle directly (assuming angle 0 = UP)
      const angle = localBody.angle;
      const forceMagnitude = PLAYER_THRUST_FORCE;
      const force = {
        x: Math.sin(angle) * forceMagnitude,
        y: -Math.cos(angle) * forceMagnitude,
      }; // Apply force in the direction the body is pointing (UP = angle 0)
      MatterBody.applyForce(localBody, localBody.position, force);
    }
    */

    // Handle sending input based on current state (including polled orientation)
    this.handleAndSendInput(targetAngleRad);

    // Update local rocket visuals via interpolation (if it exists)
    if (this.rocket) {
      this.rocket.update(delta); // Rocket update now only handles interpolation
      this.updateUIElements(); // Update HUD
    }

    // --- Update Remote Rockets ---
    this.remotePlayers.forEach((remoteRocket) => {
      remoteRocket.update(delta); // Call update for interpolation
    });
    // ---------------------------

    // Update other controllers like zoom
    this.updateControllers(delta);
  }

  shutdown(): void {
    Logger.info(LOGGER_SOURCE, "MainScene shutting down...");

    this.shutdownMultiplayer();
    this.shutdownControllers();
    this.shutdownOrientation();
    this.shutdownPhysicsAndEntities();
    this.shutdownUI();

    // Phaser handles input listener cleanup automatically

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

  private setupPhysics(): void {
    this.physicsManager = new PhysicsManager(this);
    Logger.info(LOGGER_SOURCE, "PhysicsManager initialized.");
  }

  private setupCamera(): void {
    this.cameras.main.setBackgroundColor("#000000"); // Black for space
    Logger.info(LOGGER_SOURCE, "Camera background set.");
  }

  private createEntities(): void {
    Logger.info(LOGGER_SOURCE, "Setting up entity placeholders...");
    // Local Rocket creation is now deferred until the first server state update.
    // Camera follow is also deferred.
  }

  private setupControllers(): void {
    this.zoomController = new ZoomController(this);
    Logger.info(LOGGER_SOURCE, "ZoomController initialized.");
  }

  private initializeMultiplayer(): void {
    Logger.info(LOGGER_SOURCE, "Initializing MultiplayerService...");
    this.multiplayerService = multiplayerService;

    // Use service listener for player add (covers initial sync & joins)
    this.multiplayerService.addPlayerAddListener(
      this.handlePlayerInitialAdd.bind(this)
    );
    this.multiplayerService.addPlayerRemoveListener(
      this.handlePlayerRemove.bind(this)
    );
    this.multiplayerService.addPhysicsUpdateListener(
      this.handlePhysicsUpdate.bind(this)
    );
    this.multiplayerService.addStatusListener(
      this.handleConnectionStatusChange.bind(this)
    );
    this.multiplayerService.addPlanetAddListener(this.handlePlanetAdd);
    this.multiplayerService.addPlanetRemoveListener(this.handlePlanetRemove);

    this.multiplayerService.connect().catch((err) => {
      Logger.error(LOGGER_SOURCE, "Initial connection failed:", err);
    });
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
          Logger.debug(
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

  private updateControllers(delta: number): void {
    if (this.zoomController) {
      this.zoomController.update(delta);
    }
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

  private updateUIElements(): void {
    // Guard moved to the main update loop
    if (this.rocket?.body && this.debugHud) {
      // Check rocket and body exist
      const pos = this.rocket.body.position;
      const vel = this.rocket.body.velocity;
      const speed = Math.sqrt(vel.x * vel.x + vel.y * vel.y);
      const angleDeg = Phaser.Math.RadToDeg(this.rocket.body.angle);
      // Calculate density using the shared function, mapping Planet instances to required data
      const density = PhysicsLogic.calculateDensityAt(
        pos,
        Array.from(this.planetObjects.values()).map((p) => ({
          x: p.body.position.x, // Get position from physics body
          y: p.body.position.y,
          radius: p.radius,
          atmosphereHeight: p.atmosphereHeight,
          surfaceDensity: p.surfaceDensity,
        }))
      );

      this.debugHud.update({
        posX: pos.x,
        posY: pos.y,
        velX: vel.x,
        velY: vel.y,
        speed: speed,
        angleDeg: angleDeg,
        density: density, // Pass calculated density
        currentTimeString: Logger.getCurrentTimestampString(),
      });
    }
  }

  // --- Collision Handling ---

  private handleCollisionStart(
    event: Phaser.Physics.Matter.Events.CollisionStartEvent
  ): void {
    for (const pair of event.pairs) {
      const { bodyA, bodyB } = pair;

      // Check for Rocket-Planet collision
      const rocketBody = this.rocket?.body;
      if (rocketBody && (bodyA === rocketBody || bodyB === rocketBody)) {
        const otherBody = bodyA === rocketBody ? bodyB : bodyA;
        let collidedPlanetId: string | null = null;
        for (const planetObj of this.planetObjects.values()) {
          if (otherBody.id === planetObj.body.id) {
            collidedPlanetId = planetObj.config.id.toString();
            break;
          }
        }
        if (collidedPlanetId) {
          const rocketOwnerId = this.rocket?.ownerId || "unknown";
          Logger.info(
            LOGGER_SOURCE,
            `Collision detected between: rocket '${rocketOwnerId}' and planet '${collidedPlanetId}'`
          );
          // TODO: Implement planet collision consequence
          continue; // Collision handled, move to next pair
        }
      }

      // Check for Rocket-Rocket collision
      const labelA = bodyA.label || "";
      const labelB = bodyB.label || "";
      if (labelA.startsWith("rocket-") && labelB.startsWith("rocket-")) {
        const rocketIdA = labelA.split("-").slice(1).join("-") || "unknownA";
        const rocketIdB = labelB.split("-").slice(1).join("-") || "unknownB";

        // --- Add Detailed Logging ---
        Logger.info(
          LOGGER_SOURCE,
          `Rocket-Rocket Collision Event: '${rocketIdA}' vs '${rocketIdB}'`
        );
        // Log relevant properties of both bodies
        Logger.debug(LOGGER_SOURCE, "Body A Props:", {
          id: bodyA.id,
          label: bodyA.label,
          mass: bodyA.mass,
          isSensor: bodyA.isSensor,
          isStatic: bodyA.isStatic,
          collisionFilter: bodyA.collisionFilter,
          restitution: bodyA.restitution,
        });
        Logger.debug(LOGGER_SOURCE, "Body B Props:", {
          id: bodyB.id,
          label: bodyB.label,
          mass: bodyB.mass,
          isSensor: bodyB.isSensor,
          isStatic: bodyB.isStatic,
          collisionFilter: bodyB.collisionFilter,
          restitution: bodyB.restitution,
        });
        // --- End Detailed Logging ---

        // TODO: Implement rocket-rocket collision consequence
        continue; // Collision handled
      }

      // Add other collision checks here (e.g., rocket-debris)
    }
  }

  // --- Multiplayer Event Handlers ---

  private handlePlayerInitialAdd(
    playerId: string,
    playerState: PlayerState
  ): void {
    Logger.debug(
      LOGGER_SOURCE,
      `handlePlayerInitialAdd triggered for player: ${playerId}`
    );
    const localSessionId = this.multiplayerService?.getSessionId();

    // --- LOCAL PLAYER ---
    if (localSessionId && playerId === localSessionId && !this.rocket) {
      Logger.info(
        LOGGER_SOURCE,
        `Initializing LOCAL player ${playerId} from add event at (${playerState.x.toFixed(
          1
        )}, ${playerState.y.toFixed(1)})`
      );
      this.rocket = new Rocket(
        this,
        playerState.x,
        playerState.y,
        playerId,
        playerState.angle
      );
      if (this.rocket.body) {
        // Optionally set initial velocity if provided by server
        // MatterBody.setVelocity(this.rocket.body, { x: playerState.vx ?? 0, y: playerState.vy ?? 0 });
      }
      if (this.physicsManager && this.rocket?.body) {
        this.physicsManager.registerRocket(this.rocket); // Register ONLY local rocket
        this.cameras.main.startFollow(this.rocket.gameObject);
        Logger.info(
          LOGGER_SOURCE,
          "Local rocket created, registered, camera following."
        );
      } else {
        Logger.error(
          LOGGER_SOURCE,
          "Failed to register local rocket/start camera follow."
        );
      }
      // --- REMOTE PLAYER ---
    } else if (localSessionId && playerId !== localSessionId) {
      if (this.remotePlayers.has(playerId)) {
        Logger.warn(
          LOGGER_SOURCE,
          `Remote player ${playerId} added again? Ignoring.`
        );
        return;
      }
      Logger.info(
        LOGGER_SOURCE,
        `Initializing REMOTE player ${playerId} from add event at (${playerState.x.toFixed(
          1
        )}, ${playerState.y.toFixed(1)})`
      );
      // Pass initial angle to remote rocket constructor too
      const remoteRocket = new Rocket(
        this,
        playerState.x,
        playerState.y,
        playerId,
        playerState.angle // Pass initial angle
      );
      if (remoteRocket.body) {
        // Set initial velocity for remote physics body if needed
        // MatterBody.setVelocity(remoteRocket.body, { x: playerState.vx ?? 0, y: playerState.vy ?? 0 });
      } else {
        Logger.error(
          LOGGER_SOURCE,
          `Failed to create body for remote rocket ${playerId}`
        );
      }
      // Store the full Rocket instance
      this.remotePlayers.set(playerId, remoteRocket);
      // DO NOT register remote rocket with PhysicsManager gravity/updates
      // DO NOT make camera follow remote rockets
    } else {
      Logger.warn(
        LOGGER_SOURCE,
        `Add event received for ${playerId} in unexpected state (localId: ${localSessionId}, localRocket: ${!!this
          .rocket})`
      );
    }
  }

  private handlePhysicsUpdate(updateData: {
    [sessionId: string]: Partial<PlayerState>;
  }): void {
    // Logger.debug(LOGGER_SOURCE, "handlePhysicsUpdate received data for players:", Object.keys(updateData));

    for (const sessionId in updateData) {
      const state = updateData[sessionId];
      let targetRocket: Rocket | undefined;

      // --- LOCAL PLAYER: State Correction ---
      if (sessionId === this.multiplayerService.getSessionId()) {
        targetRocket = this.rocket; // Update the local rocket
        if (targetRocket?.body) {
          const correctionFactor = CLIENT_PHYSICS_CORRECTION_FACTOR;

          // --- Physics Body Correction (Handle Sparse Delta) ---
          let needsPosUpdate = false;
          let correctedPosX = targetRocket.body.position.x;
          let correctedPosY = targetRocket.body.position.y;

          if (typeof state?.x === "number") {
            correctedPosX = Phaser.Math.Linear(
              targetRocket.body.position.x,
              state.x,
              correctionFactor
            );
            needsPosUpdate = true;
          }
          if (typeof state?.y === "number") {
            correctedPosY = Phaser.Math.Linear(
              targetRocket.body.position.y,
              state.y,
              correctionFactor
            );
            needsPosUpdate = true;
          }
          if (needsPosUpdate) {
            MatterBody.setPosition(targetRocket.body, {
              x: correctedPosX,
              y: correctedPosY,
            });
          }

          let needsVelUpdate = false;
          let correctedVelX = targetRocket.body.velocity.x;
          let correctedVelY = targetRocket.body.velocity.y;

          if (typeof state?.vx === "number") {
            correctedVelX = Phaser.Math.Linear(
              targetRocket.body.velocity.x,
              state.vx,
              correctionFactor
            );
            needsVelUpdate = true;
          }
          if (typeof state?.vy === "number") {
            correctedVelY = Phaser.Math.Linear(
              targetRocket.body.velocity.y,
              state.vy,
              correctionFactor
            );
            needsVelUpdate = true;
          }
          if (needsVelUpdate) {
            MatterBody.setVelocity(targetRocket.body, {
              x: correctedVelX,
              y: correctedVelY,
            });
          }

          if (typeof state?.angle === "number") {
            const correctedAngle = Phaser.Math.Angle.RotateTo(
              targetRocket.body.angle,
              state.angle,
              correctionFactor
            );
            MatterBody.setAngle(targetRocket.body, correctedAngle);
          }
          // --- End Physics Body Correction ---

          // Set thrust state based on server update
          if (typeof state?.isThrusting === "boolean") {
            targetRocket.isThrusting = state.isThrusting;
          }

          // TODO: Optionally implement more sophisticated reconciliation if needed (e.g., smooth correction over a few frames)
          // Logger.debug(LOGGER_SOURCE, `Corrected local rocket state from server: x=${state.x?.toFixed(1)}, y=${state.y?.toFixed(1)}, angle=${state.angle?.toFixed(2)}`);
        } else {
          Logger.warn(
            LOGGER_SOURCE,
            `Received state update for local player, but local rocket/body doesn't exist yet.`
          );
        }
      } else {
        // --- REMOTE PLAYER: Update Body & Interpolation Target ---
        targetRocket = this.remotePlayers.get(sessionId); // Update a remote rocket
        if (targetRocket) {
          // Directly set the remote physics body position/angle for reference
          if (targetRocket.body) {
            MatterBody.setPosition(targetRocket.body, {
              x: state?.x ?? targetRocket.body.position.x,
              y: state?.y ?? targetRocket.body.position.y,
            });
            MatterBody.setAngle(
              targetRocket.body,
              state?.angle ?? targetRocket.body.angle
            );
            // We don't set velocity/angularVel for remote, let interpolation handle visuals
          }

          // Set thrust state based on server update
          if (typeof state?.isThrusting === "boolean") {
            targetRocket.isThrusting = state.isThrusting;
          }
        } else {
          // This could happen if a state update arrives before the player add notification?
          Logger.warn(
            LOGGER_SOURCE,
            `handlePhysicsUpdate: Received state for unknown/uncreated remote rocket: ${sessionId}`
          );
        }
        // ---------------------------------------------
      }
    }
  }

  private handlePlayerRemove(playerId: string): void {
    const localSessionId = this.multiplayerService?.getSessionId();
    if (localSessionId && playerId === localSessionId) {
      Logger.warn(LOGGER_SOURCE, "Received remove event for local player?");
      if (this.rocket) {
        this.rocket.destroy(); // Use destroy method
        this.rocket = undefined;
      }
      return;
    }

    Logger.info(LOGGER_SOURCE, `Remote Player ${playerId} left`);
    const remoteRocket = this.remotePlayers.get(playerId);
    if (remoteRocket) {
      remoteRocket.destroy(); // Call destroy on the Rocket instance
      this.remotePlayers.delete(playerId);
    } else {
      Logger.warn(
        LOGGER_SOURCE,
        `Received remove for unknown player ${playerId}`
      );
    }
  }

  private handleConnectionStatusChange(status: ConnectionStatus): void {
    Logger.info(LOGGER_SOURCE, `Connection status changed: ${status}`);
    let text = `Status: ${status}`;
    let color = "#ffffff"; // Default white

    switch (status) {
      case "connected":
        color = "#00ff00"; // Green
        text = `Status: Connected (ID: ${this.multiplayerService.getSessionId()})`;
        // Initial planets/players are now handled by state.onAdd listeners
        // No need to call handleInitialPlanets here anymore
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

    if (this.connectionStatusText) {
      this.connectionStatusText.setText(text);
      this.connectionStatusText.setColor(color);
    }
  }

  // --- Planet Handlers ---

  // Signature matches addPlanetAddListener: (planetId: string, planetData: PlanetData & { ... })
  private handlePlanetAdd = (
    planetId: string,
    planetData: PlanetData & {
      seed: string;
      colors: { base: string; accent1?: string; accent2?: string };
      noiseParams: { scale: number; octaves?: number };
    }
  ): void => {
    if (this.planetObjects.has(planetId)) {
      Logger.warn(
        LOGGER_SOURCE,
        `Planet ${planetId} already exists visually/physically (add event).`
      );
      return;
    }
    // Validate required config data before proceeding
    if (!planetData.seed || !planetData.colors || !planetData.noiseParams) {
      Logger.error(
        LOGGER_SOURCE,
        `Planet ${planetId} received via add event missing required config data. Skipping.`
      );
      return;
    }
    Logger.info(
      LOGGER_SOURCE,
      `Adding planet ${planetId} via add event at (${planetData.x}, ${planetData.y}) R=${planetData.radius}`
    );

    const config: PlanetConfig = {
      id: planetId,
      seed: planetData.seed,
      radius: planetData.radius,
      mass: planetData.mass,
      atmosphereHeight: planetData.atmosphereHeight,
      surfaceDensity: planetData.surfaceDensity,
      colors: { ...planetData.colors },
      noiseParams: { ...planetData.noiseParams },
    };

    const planet = new Planet(this, planetData.x, planetData.y, config);
    this.planetObjects.set(planetId, planet);

    // Check if planet.body exists before registering gravity source
    if (planet.body) {
      this.physicsManager.addGravitySource(planet.body, planetData);
      Logger.info(
        LOGGER_SOURCE,
        `  Planet ${planetId} added via add event. Gravity source registered. Map size: ${this.planetObjects.size}`
      );
    } else {
      Logger.error(
        LOGGER_SOURCE,
        `Planet ${planetId} created but body is missing. Cannot add gravity source.`
      );
    }

    // Update physics manager map regardless
    this.physicsManager.setPlanetObjectsMap(this.planetObjects);
  };

  // Signature matches addPlanetRemoveListener: (planetId: string, planetData?: PlanetData)
  // Service might pass the state or just the ID. Assume just ID for safety.
  private handlePlanetRemove = (planetId: string): void => {
    Logger.info(
      LOGGER_SOURCE,
      `Handling remove for planet ${planetId} via remove event`
    );
    const planetToRemove = this.planetObjects.get(planetId);
    if (planetToRemove) {
      // Check body exists before trying to remove gravity
      if (planetToRemove.body) {
        // Use type assertion to 'any' to bypass strict check as BodyType didn't work
        this.physicsManager.removeGravitySource(planetToRemove.body as any);
      } else {
        Logger.warn(
          LOGGER_SOURCE,
          `Planet ${planetId} body missing during removeGravitySource.`
        );
      }
      planetToRemove.destroy(); // Destroy Planet instance
      this.planetObjects.delete(planetId);
      Logger.info(
        LOGGER_SOURCE,
        `Planet ${planetId} removed via remove event. Map size: ${this.planetObjects.size}`
      );
      this.physicsManager.setPlanetObjectsMap(this.planetObjects);
    } else {
      Logger.warn(
        LOGGER_SOURCE,
        `Planet ${planetId} not found for removal (remove event).`
      );
    }
  };

  // --- Cleanup Helpers ---

  private cleanupMultiplayerEntities(): void {
    Logger.warn(LOGGER_SOURCE, "Cleaning up multiplayer entities...");
    // Remote Players
    this.remotePlayers.forEach((rocketInstance) => {
      rocketInstance.destroy(); // Call destroy on each Rocket instance
    });
    this.remotePlayers.clear();

    // Remote Planets (remove body AND destroy instance)
    this.planetObjects.forEach((planetInstance, planetId) => {
      Logger.debug(
        LOGGER_SOURCE,
        `Cleaning up planet ${planetId} on disconnect`
      );
      this.physicsManager.removeGravitySource(planetInstance.body); // Remove gravity first
      planetInstance.destroy(); // Destroy Planet instance
    });
    this.planetObjects.clear();

    // Update physics manager with empty map
    this.physicsManager.setPlanetObjectsMap(this.planetObjects);
    Logger.info(LOGGER_SOURCE, "Multiplayer entities cleaned up.");
  }

  // --- Shutdown Helpers (Called from shutdown) ---

  private shutdownMultiplayer(): void {
    if (this.multiplayerService) {
      // --- Unregister listeners ---
      // Remove state listeners if they exist (check MultiplayerService implementation)
      // Assuming direct state listeners might need manual removal if not handled by service.disconnect()
      // Example: if (this.multiplayerService.state) {
      //   this.multiplayerService.state.players.onAdd.unsubscribe(); // Check actual method
      // }

      // Remove service event listeners
      this.multiplayerService.removePlayerRemoveListener(
        this.handlePlayerRemove
      );
      this.multiplayerService.removeStatusListener(
        this.handleConnectionStatusChange
      );
      // No need to remove state listeners explicitly if service handles it on disconnect
      // this.multiplayerService.state.planets.onAdd.unsubscribe();
      // this.multiplayerService.state.planets.onRemove.unsubscribe();

      this.multiplayerService.disconnect();
      Logger.info(LOGGER_SOURCE, "Multiplayer service disconnected.");
    }
    this.cleanupMultiplayerEntities();
  }

  private shutdownControllers(): void {
    if (this.zoomController) {
      this.zoomController.destroy();
      Logger.info(LOGGER_SOURCE, "ZoomController destroyed.");
    }
  }

  private shutdownOrientation(): void {
    if (this.orientationManager) {
      this.orientationManager.destroy();
      Logger.info(LOGGER_SOURCE, "DeviceOrientationManager destroyed.");
    }
  }

  private shutdownPhysicsAndEntities(): void {
    // Planets are handled in cleanupMultiplayerEntities or direct shutdown
    // Destroy local rocket if it exists
    if (this.rocket) {
      // If Rocket class has its own destroy method for cleanup:
      // this.rocket.destroy();
      // Otherwise, Phaser manages the GameObject destruction when scene shuts down.
      // Just nullify the reference.
      this.rocket = undefined;
      Logger.info(LOGGER_SOURCE, "Local rocket reference cleared.");
    }
    // Destroy physics manager LAST
    if (this.physicsManager) {
      this.physicsManager.destroy();
      Logger.info(LOGGER_SOURCE, "PhysicsManager destroyed.");
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
    // Check thrust input (Keyboard or Pointer)
    // Thrust START/STOP messages are now sent directly from the input handlers
    // Local thrust application is handled by the isLocalThrusting flag in the main update loop

    // --- Send Angle Input ---
    // Use a member variable to track last sent angle
    if (targetAngleRad !== null) {
      const angleSendThreshold = 0.05;
      if (
        this.lastSentAngle === undefined || // Use undefined check for first time
        Math.abs(targetAngleRad - (this.lastSentAngle ?? 0)) >
          angleSendThreshold
      ) {
        this.sendInput("set_angle", targetAngleRad); // Re-enable sending angle input
        this.lastSentAngle = targetAngleRad;
        Logger.debug(
          LOGGER_SOURCE,
          `Update Loop: Sent set_angle=${targetAngleRad.toFixed(2)}`
        );
      }
    }

    // --- REMOVED Beta Gravity Application ---
    // const orientation = this.orientationManager.getOrientation(); // Or getBeta directly?
    // if (orientation && typeof orientation.beta === "number" && this.physicsManager) {
    //   this.physicsManager.updateGravityFromOrientation(orientation.beta); // Incorrect method
    // }
  }
}
