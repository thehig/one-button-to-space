import { Room, Client } from "@colyseus/core";
import {
  RoomState,
  PlayerState,
  PlanetData,
  PlanetColors,
  PlanetNoiseParams,
} from "../colyseus/schema/State";
// Import file system and path modules
import fs from "fs";
import path from "path";
// Import the generator function
import { generatePlanetDataFromName } from "../utils/PlanetGenerator";
import { ServerPhysicsManager } from "../physics/ServerPhysicsManager";
import { Logger } from "@one-button-to-space/shared";
// Import the new input type
// @ts-ignore - Shared code outside rootDir
import { PlayerInputMessage } from "@one-button-to-space/shared";
// Import shared physics logic
// @ts-ignore - Shared code outside rootDir
import { PhysicsLogic } from "@one-button-to-space/shared";
// Import shared constant
// @ts-ignore - Shared code outside rootDir
import { Constants } from "@one-button-to-space/shared";
const {
  PLAYER_THRUST_FORCE,
  PLAYER_MASS,
  PLAYER_FRICTION_AIR,
  PLAYER_ANGULAR_DAMPING,
  SYNC_THRESHOLD_POSITION,
  SYNC_THRESHOLD_VELOCITY,
  SYNC_THRESHOLD_ANGLE,
} = Constants;

// Import Matter.js types
import Matter from "matter-js";

const __dirname = path.resolve();

// Define the source constant for logging
const LOGGER_SOURCE = "🚪🎮";

// Define the type for the world file structure
interface WorldPlanetDefinition {
  name: string;
  x: number;
  y: number;
}

// Constants for player physics body
const PLAYER_WIDTH = 40;
const PLAYER_HEIGHT = 100;
const PLAYER_ROTATION_SPEED = 0.05;

export class GameRoom extends Room<RoomState> {
  // Max clients default
  maxClients = 256;

  // Store the loaded world data
  private worldPlanets: WorldPlanetDefinition[] = [];

  // Add physics manager instance
  private physicsManager!: ServerPhysicsManager;

  // Add property to hold the interval ID
  private physicsLoopInterval: NodeJS.Timeout | null = null;

  // Define fixed timestep (e.g., 60Hz)
  private readonly physicsTimeStep = 1000 / 60;

  // Properties for time accumulation
  private accumulator: number = 0;
  private lastPhysicsUpdateTime: number = 0;

  // Map to store player session IDs to their physics bodies
  private playerBodies: Map<string, Matter.Body> = new Map();
  // Map to store player thrust state
  private playerThrustState: Map<string, boolean> = new Map();
  // Map to store pending inputs for each player
  private playerInputQueue: Map<string, PlayerInputMessage[]> = new Map();
  // Store the last broadcasted state for delta compression
  private lastBroadcastState: { [sessionId: string]: Partial<PlayerState> } =
    {};

  onCreate(options: any) {
    Logger.info(
      LOGGER_SOURCE,
      `Room ${this.roomId} created with options:`,
      options
    );

    // Initialize the physics manager
    this.physicsManager = new ServerPhysicsManager();
    Logger.info(LOGGER_SOURCE, "ServerPhysicsManager initialized.");

    // Initialize the game state
    this.setState(new RoomState());
    Logger.info(LOGGER_SOURCE, "GameState initialized.");

    // --- Load World Definition ---
    try {
      const worldFilePath = path.join(__dirname, "worlds/default.world.json");
      Logger.info(
        LOGGER_SOURCE,
        `Attempting to load world file from: ${worldFilePath}`
      );
      const worldFileContent = fs.readFileSync(worldFilePath, "utf-8");
      this.worldPlanets = JSON.parse(
        worldFileContent
      ) as WorldPlanetDefinition[];
      Logger.info(
        LOGGER_SOURCE,
        `Successfully loaded ${this.worldPlanets.length} planets from world file.`
      );
    } catch (error) {
      Logger.error(
        LOGGER_SOURCE,
        "Failed to load world definition file:",
        error
      );
      this.worldPlanets = [];
    }

    // --- Initialize Planets from World Data ---
    if (this.worldPlanets.length > 0) {
      this.worldPlanets.forEach((worldPlanet: WorldPlanetDefinition) => {
        const basePlanetData = generatePlanetDataFromName(worldPlanet.name);
        // Assign properties excluding colors and noiseParams first
        const planetState = new PlanetData().assign({
          id: worldPlanet.name,
          x: worldPlanet.x,
          y: worldPlanet.y,
          radius: basePlanetData.radius,
          mass: basePlanetData.mass,
          atmosphereHeight: basePlanetData.atmosphereHeight,
          surfaceDensity: basePlanetData.surfaceDensity,
          seed: worldPlanet.name, // Use name as seed for consistency
        });

        // Assign colors and noiseParams as new schema instances
        planetState.colors = new PlanetColors().assign({
          base: basePlanetData.colors.base,
          accent1: basePlanetData.colors.accent1 ?? basePlanetData.colors.base,
          accent2: basePlanetData.colors.accent2 ?? basePlanetData.colors.base,
        });
        planetState.noiseParams = new PlanetNoiseParams().assign({
          scale: basePlanetData.noiseParams.scale,
          octaves: basePlanetData.noiseParams.octaves ?? 1,
        });

        // Add to room state using the unique name as the key
        this.state.planets.set(worldPlanet.name, planetState);
        Logger.info(
          LOGGER_SOURCE,
          `Initialized planet '${worldPlanet.name}' in state.`
        );

        // Create and add planet physics body
        const planetBody = Matter.Bodies.circle(
          planetState.x,
          planetState.y,
          planetState.radius,
          { isStatic: true, label: `planet-${worldPlanet.name}` }
        );
        this.physicsManager.addBody(planetBody);
        Logger.info(
          LOGGER_SOURCE,
          `Added planet '${worldPlanet.name}' physics body.`
        );
      });
    } else {
      Logger.warn(
        LOGGER_SOURCE,
        "No planets loaded from world file, starting with empty planet state."
      );
    }

    // Initialize last update time before starting loop
    this.lastPhysicsUpdateTime = Date.now();
    this.accumulator = 0;

    // Start the physics update loop with accumulation logic
    this.physicsLoopInterval = setInterval(() => {
      const now = Date.now();
      const elapsedMs = now - this.lastPhysicsUpdateTime;
      this.lastPhysicsUpdateTime = now;

      // Add elapsed time to accumulator
      this.accumulator += elapsedMs;

      // Log if accumulator gets too large (potential performance issue)
      if (this.accumulator > this.physicsTimeStep * 10) {
        // e.g., 10 frames behind
        Logger.warn(
          LOGGER_SOURCE,
          `Physics loop accumulator high: ${this.accumulator.toFixed(
            0
          )}ms. Resetting.`
        );
        // Reset accumulator to prevent spiral of death, but log it
        this.accumulator = 0;
      }

      // Perform fixed updates as long as accumulator allows
      while (this.accumulator >= this.physicsTimeStep) {
        // --- Process Input Queue BEFORE Physics Step ---
        this.playerBodies.forEach((playerBody, sessionId) => {
          const queue = this.playerInputQueue.get(sessionId);
          if (queue && queue.length > 0) {
            // Process all queued inputs for this step
            queue.forEach((input) => {
              switch (input.input) {
                case "thrust_start":
                  this.playerThrustState.set(sessionId, true);
                  break;
                case "thrust_stop":
                  this.playerThrustState.set(sessionId, false);
                  break;
                case "set_angle":
                  // We already validated value is a number in onMessage
                  Matter.Body.setAngle(playerBody, input.value as number);
                  break;
              }
            });
            // Clear the queue after processing for this step
            queue.length = 0;
          }
        });
        // --- End Input Processing ---

        // --- Apply Shared Physics Logic (Gravity, Air Resistance) BEFORE Engine Step ---
        // Prepare gravity sources from current planet state
        const simpleGravitySources = Array.from(
          this.state.planets.values()
        ).map((p) => ({
          position: { x: p.x, y: p.y },
          mass: p.mass,
        }));

        this.playerBodies.forEach((playerBody, sessionId) => {
          // 1. Apply Environmental Forces using Shared Logic
          PhysicsLogic.calculateAndApplyGravity(
            playerBody,
            simpleGravitySources
          );

          // Use the shared function, passing the Map's values()
          const density = PhysicsLogic.calculateDensityAt(
            playerBody.position,
            this.state.planets.values()
          );
          PhysicsLogic.calculateAndApplyAirResistance(playerBody, density);

          // 3. Apply Angular Damping
          const dampingFactor = 1 - PLAYER_ANGULAR_DAMPING; // Damping factor (e.g., 0.95 for 0.05 damping)
          // Ensure angular velocity doesn't get infinitesimally small causing NaN issues
          if (Math.abs(playerBody.angularVelocity) > 0.0001) {
            Matter.Body.setAngularVelocity(
              playerBody,
              playerBody.angularVelocity * dampingFactor
            );
          } else if (playerBody.angularVelocity !== 0) {
            // Snap to zero if very close
            Matter.Body.setAngularVelocity(playerBody, 0);
          }

          // 4. Apply Player Input Forces (e.g., Thrust)
          if (this.playerThrustState.get(sessionId)) {
            const angle = playerBody.angle - Math.PI / 2; // Assuming angle 0 is UP for player visual
            const forceMagnitude = PLAYER_THRUST_FORCE;
            const force = {
              x: Math.cos(angle) * forceMagnitude,
              y: Math.sin(angle) * forceMagnitude,
            };
            Matter.Body.applyForce(playerBody, playerBody.position, force);
          }
        });
        // --- End Shared Physics Logic Application ---

        // Update physics engine AFTER applying custom forces
        this.physicsManager.update(this.physicsTimeStep);

        // Update player state from physics bodies AFTER engine step
        this.updatePlayerStatesFromPhysics();
        this.state.physicsStep++; // Increment physics step counter
        this.accumulator -= this.physicsTimeStep;

        // Broadcast updated physics state using delta compression
        const currentPlayerStates: {
          [sessionId: string]: Partial<PlayerState>;
        } = {};
        this.state.players.forEach((player, sessionId) => {
          currentPlayerStates[sessionId] = {
            x: player.x,
            y: player.y,
            angle: player.angle,
            vx: player.vx,
            vy: player.vy,
            angularVelocity: player.angularVelocity, // Consider thresholding this too?
            isSleeping: player.isSleeping,
            isThrusting: this.playerThrustState.get(sessionId) ?? false,
          };
        });

        // Calculate delta state
        const deltaState: { [sessionId: string]: Partial<PlayerState> } = {};
        for (const sessionId in currentPlayerStates) {
          const currentState = currentPlayerStates[sessionId];
          const lastState = this.lastBroadcastState[sessionId];
          const playerDelta: Partial<PlayerState> = {};
          let hasChanges = false;

          if (!lastState) {
            // New player or first broadcast, send everything
            Object.assign(playerDelta, currentState);
            hasChanges = true;
          } else {
            // Compare properties
            if (
              Math.abs((currentState?.x ?? 0) - (lastState?.x ?? 0)) >
                SYNC_THRESHOLD_POSITION ||
              Math.abs((currentState?.y ?? 0) - (lastState?.y ?? 0)) >
                SYNC_THRESHOLD_POSITION
            ) {
              playerDelta.x = currentState?.x;
              playerDelta.y = currentState?.y;
              hasChanges = true;
            }
            if (
              Math.abs((currentState?.vx ?? 0) - (lastState?.vx ?? 0)) >
                SYNC_THRESHOLD_VELOCITY ||
              Math.abs((currentState?.vy ?? 0) - (lastState?.vy ?? 0)) >
                SYNC_THRESHOLD_VELOCITY
            ) {
              playerDelta.vx = currentState?.vx;
              playerDelta.vy = currentState?.vy;
              hasChanges = true;
            }
            if (
              Math.abs((currentState?.angle ?? 0) - (lastState?.angle ?? 0)) >
              SYNC_THRESHOLD_ANGLE
            ) {
              playerDelta.angle = currentState?.angle;
              hasChanges = true;
            }
            // Add threshold for angularVelocity?
            // if (Math.abs((currentState?.angularVelocity ?? 0) - (lastState?.angularVelocity ?? 0)) > SYNC_THRESHOLD_ANGULAR_VELOCITY) {
            //   playerDelta.angularVelocity = currentState?.angularVelocity;
            //   hasChanges = true;
            // }
            if (currentState?.isSleeping !== lastState?.isSleeping) {
              playerDelta.isSleeping = currentState?.isSleeping;
              hasChanges = true;
            }
            if (currentState?.isThrusting !== lastState?.isThrusting) {
              playerDelta.isThrusting = currentState?.isThrusting;
              hasChanges = true;
            }
          }

          if (hasChanges) {
            deltaState[sessionId] = playerDelta;
          }
        }

        if (Object.keys(deltaState).length > 0) {
          this.broadcast("physics_update", deltaState);
          // Update last broadcast state *only* for players included in the delta
          for (const sessionId in deltaState) {
            this.lastBroadcastState[sessionId] = {
              ...(this.lastBroadcastState[sessionId] ?? {}),
              ...deltaState[sessionId],
            };
          }
          // Clean up lastBroadcastState for players who might have left
          for (const sessionId in this.lastBroadcastState) {
            if (!this.state.players.has(sessionId)) {
              delete this.lastBroadcastState[sessionId];
            }
          }
        }
      }
    }, this.physicsTimeStep); // Interval still runs at target rate
    Logger.info(
      LOGGER_SOURCE,
      `Started physics loop with accumulation logic at ${this.physicsTimeStep.toFixed(
        2
      )}ms interval.`
    );

    // Register message handlers
    this.onMessage("updateState", (client, message: Partial<PlayerState>) => {
      const player = this.state.players.get(client.sessionId);
      if (player) {
        if (typeof message.x === "number") player.x = message.x;
        if (typeof message.y === "number") player.y = message.y;
        if (typeof message.angle === "number") player.angle = message.angle;
      } else {
        Logger.warn(
          LOGGER_SOURCE,
          `Received 'updateState' from unknown client: ${client.sessionId}`
        );
      }
    });

    // Register the message handler for player input
    this.onMessage<PlayerInputMessage>("player_input", (client, message) => {
      // Basic validation: Check if player queue exists
      const queue = this.playerInputQueue.get(client.sessionId);
      if (!queue) {
        Logger.warn(
          LOGGER_SOURCE,
          `Input received for player ${client.sessionId} but no queue found.`
        );
        return;
      }

      // Input-specific validation (add more as needed)
      if (message.input === "set_angle") {
        if (typeof message.value !== "number" || isNaN(message.value)) {
          Logger.warn(
            LOGGER_SOURCE,
            `Invalid value received for set_angle from ${client.sessionId}: ${message.value}`
          );
          return; // Discard invalid input
        }
        // Optional: Add angle range validation? E.g., Math.abs(message.value) < Math.PI * 2
      }

      // Add validated input to the queue
      queue.push(message);

      // REMOVED: Direct application of input
      /*
      Logger.debug(
        LOGGER_SOURCE,
        `Received player_input from ${client.sessionId}:`,
        message
      );
      const playerBody = this.playerBodies.get(client.sessionId);
      if (!playerBody) {
        Logger.warn(
          LOGGER_SOURCE,
          `Player input received for unknown body: ${client.sessionId}`
        );
        return;
      }

      // Process based on the specific input type
      switch (message.input) {
        case "thrust_start":
          this.playerThrustState.set(client.sessionId, true);
          // Logger.debug(`Thrust started for ${client.sessionId}`);
          break;
        case "thrust_stop":
          this.playerThrustState.set(client.sessionId, false);
          // Logger.debug(`Thrust stopped for ${client.sessionId}`);
          break;
        case "set_angle":
          if (typeof message.value === "number") {
            // Directly set the angle based on client input
            Matter.Body.setAngle(playerBody, message.value);
            // Logger.debug(`Set angle to ${message.value} for ${client.sessionId}`);
          } else {
            Logger.warn(
              LOGGER_SOURCE,
              `Invalid value for set_angle from ${client.sessionId}: ${message.value}`
            );
          }
          break;
        default:
          Logger.warn(
            LOGGER_SOURCE,
            `Unknown player input type: ${(message as any).input}`
          );
          break;
      }
      */
    });

    Logger.info(LOGGER_SOURCE, "Message handlers registered.");
  }

  onJoin(client: Client, options: any) {
    Logger.info(LOGGER_SOURCE, `${client.sessionId} joined! Options:`, options);

    const player = new PlayerState();

    // --- Calculate Initial Orbital Position (around first planet in the world list) ---
    const firstWorldPlanet =
      this.worldPlanets.length > 0 ? this.worldPlanets[0] : null;

    if (firstWorldPlanet) {
      const firstPlanetState = this.state.planets.get(firstWorldPlanet.name);

      if (firstPlanetState) {
        const orbitalDistance =
          firstPlanetState.radius +
          (firstPlanetState.atmosphereHeight ?? 50) +
          100;
        const randomAngle = Math.random() * Math.PI * 2;
        player.x = firstPlanetState.x + orbitalDistance * Math.cos(randomAngle);
        player.y = firstPlanetState.y + orbitalDistance * Math.sin(randomAngle);
        player.angle =
          Math.atan2(
            firstPlanetState.y - player.y,
            firstPlanetState.x - player.x
          ) +
          Math.PI / 2;
        Logger.info(
          LOGGER_SOURCE,
          `Placing player ${client.sessionId} at (${player.x.toFixed(
            1
          )}, ${player.y.toFixed(1)}) around ${firstWorldPlanet.name}`
        );
      } else {
        Logger.warn(
          LOGGER_SOURCE,
          `Planet state for '${firstWorldPlanet.name}' not found in state! Placing player at default.`
        );
        player.x = options.startX ?? Math.random() * 100;
        player.y = options.startY ?? Math.random() * 100;
        player.angle = 0;
      }
    } else {
      Logger.warn(
        LOGGER_SOURCE,
        `No planets defined in world file! Placing player at default.`
      );
      player.x = options.startX ?? Math.random() * 100;
      player.y = options.startY ?? Math.random() * 100;
      player.angle = 0;
    }
    player.cargo = "";

    // Create the physics body for the player
    const playerBody = Matter.Bodies.rectangle(
      player.x,
      player.y,
      PLAYER_WIDTH,
      PLAYER_HEIGHT,
      {
        mass: PLAYER_MASS,
        frictionAir: PLAYER_FRICTION_AIR,
        label: client.sessionId, // Use sessionId as label for easy lookup?
        // TODO: Set collision filters if needed
      }
    );
    Matter.Body.setAngle(playerBody, player.angle);

    // Add body to physics engine and map
    this.physicsManager.addBody(playerBody);
    this.playerBodies.set(client.sessionId, playerBody);

    // Update PlayerState with initial physics info (redundant if calculated before, but safe)
    player.x = playerBody.position.x;
    player.y = playerBody.position.y;
    player.angle = playerBody.angle;
    player.vx = playerBody.velocity.x;
    player.vy = playerBody.velocity.y;
    player.angularVelocity = playerBody.angularVelocity;
    player.isSleeping = playerBody.isSleeping;

    this.state.players.set(client.sessionId, player);
    // Initialize thrust state
    this.playerThrustState.set(client.sessionId, false);
    // Initialize input queue for the joining player
    this.playerInputQueue.set(client.sessionId, []);
    Logger.info(
      LOGGER_SOURCE,
      `Player ${client.sessionId} state and physics body created.`
    );

    // Send world creation time to the new client
    client.send("worldCreationTime", Logger.getWorldCreationTime());
    Logger.info(
      LOGGER_SOURCE,
      `Sent world creation time to ${client.sessionId}`
    );
  }

  onLeave(client: Client, consented: boolean) {
    Logger.info(
      LOGGER_SOURCE,
      `${client.sessionId} left! Consented: ${consented}`
    );
    const playerBody = this.playerBodies.get(client.sessionId);
    if (playerBody) {
      this.physicsManager.removeBody(playerBody);
      this.playerBodies.delete(client.sessionId);
      Logger.info(
        LOGGER_SOURCE,
        `Player ${client.sessionId} physics body removed.`
      );
    } else {
      Logger.warn(
        LOGGER_SOURCE,
        `Physics body not found for leaving client: ${client.sessionId}`
      );
    }

    // Remove thrust state for leaving player
    this.playerThrustState.delete(client.sessionId);
    // Remove input queue for leaving player
    this.playerInputQueue.delete(client.sessionId);
    // Remove last broadcast state for leaving player
    delete this.lastBroadcastState[client.sessionId];

    if (this.state.players.has(client.sessionId)) {
      this.state.players.delete(client.sessionId);
      Logger.info(LOGGER_SOURCE, `Player ${client.sessionId} state removed.`);
    } else {
      Logger.warn(
        LOGGER_SOURCE,
        `State not found for leaving client: ${client.sessionId}`
      );
    }
  }

  onDispose() {
    Logger.info(LOGGER_SOURCE, `Room ${this.roomId} disposing...`);
    // Clear the physics loop interval using standard clearInterval
    if (this.physicsLoopInterval) {
      clearInterval(this.physicsLoopInterval);
      this.physicsLoopInterval = null;
      Logger.info(LOGGER_SOURCE, "Cleared physics loop interval.");
    }
    // Clean up physics manager
    if (this.physicsManager) {
      // Remove all remaining player bodies before destroying manager
      this.playerBodies.forEach((body) => this.physicsManager.removeBody(body));
      this.playerBodies.clear();
      this.physicsManager.destroy();
      Logger.info(
        LOGGER_SOURCE,
        "ServerPhysicsManager and remaining bodies destroyed."
      );
    }
  }

  /**
   * Updates the Colyseus player states based on the current physics simulation.
   */
  private updatePlayerStatesFromPhysics(): void {
    this.state.players.forEach((player, sessionId) => {
      const body = this.playerBodies.get(sessionId);
      if (body) {
        player.x = body.position.x;
        player.y = body.position.y;
        player.angle = body.angle;
        player.vx = body.velocity.x;
        player.vy = body.velocity.y;
        player.angularVelocity = body.angularVelocity;
        player.isSleeping = body.isSleeping;
        // Update other properties as needed
      } else {
        // This case shouldn't happen if onLeave is correct, but log if it does
        Logger.warn(
          LOGGER_SOURCE,
          `Physics body missing for player state update: ${sessionId}`
        );
      }
    });
  }

  updatePhysics(deltaTime: number) {
    if (!this.physicsManager) {
      Logger.warn(
        LOGGER_SOURCE,
        "updatePhysics called before physicsManager initialized."
      );
      return;
    }
    // Physics stepping is handled by the main setInterval loop via physicsManager.update()
    // Engine.update(this.physicsManager.engine, deltaTime); // This call should not be here

    // Apply forces based on current player input state (like thrust)
    this.playerBodies.forEach((body, sessionId) => {
      // Apply thrust if active
      if (this.playerThrustState.get(sessionId)) {
        const angle = body.angle - Math.PI / 2;
        const forceMagnitude = PLAYER_THRUST_FORCE;
        const force = {
          x: Math.cos(angle) * forceMagnitude,
          y: Math.sin(angle) * forceMagnitude,
        };
        Matter.Body.applyForce(body, body.position, force);
      }

      // --- Redundant state update removed ---
      // Player state (x, y, vx, vy, etc.) is updated from physics bodies
      // in the updatePlayerStatesFromPhysics() method, which is called
      // within the main physics loop (setInterval) *after* physicsManager.update()
      /*
      const playerState = this.state.players.get(sessionId);
      if (playerState) {
        playerState.x = body.position.x;
        playerState.y = body.position.y;
        playerState.angle = body.angle;
        playerState.vx = body.velocity.x;
        playerState.vy = body.velocity.y;
        playerState.angularVelocity = body.angularVelocity;
        playerState.isSleeping = body.isSleeping;
      } else {
        Logger.warn(
          LOGGER_SOURCE,
          `Player state not found for sessionId: ${sessionId}`
        );
      }
      */
      // -------------------------------------
    });
  }
}
