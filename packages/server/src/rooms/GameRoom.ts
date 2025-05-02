// Import file system and path modules
import fs from "fs";
import path from "path";

// Import the generator function
import { generatePlanetDataFromName } from "../utils/PlanetGenerator";
import { ServerPhysicsManager } from "../physics/ServerPhysicsManager";

import {
  RoomState,
  PlayerState,
  PlanetData,
  VectorSchema,
} from "../schema/State";

import {
  Logger,
  PlayerInputMessage,
  PhysicsLogic,
  Constants,
} from "@one-button-to-space/shared";

const {
  PLAYER_THRUST_FORCE,
  PLAYER_MASS,
  PLAYER_FRICTION_AIR,
  PLAYER_ANGULAR_DAMPING,
  SYNC_THRESHOLD_POSITION,
  SYNC_THRESHOLD_VELOCITY,
  SYNC_THRESHOLD_ANGLE,
  PHYSICS_TIMESTEP_MS,
  INITIAL_ORBITAL_BUFFER,
  DEFAULT_SPAWN_AREA_SIZE,
  MAX_PLAYERS,
  PLAYER_FRICTION,
  PLAYER_RESTITUTION,
  DEFAULT_ATMOSPHERE_HEIGHT,
  ANGULAR_VELOCITY_SNAP_THRESHOLD,
  CollisionCategory,
  rocketVertices,
} = Constants;

// Import Matter.js types
import Matter from "matter-js";
import { Room, Client } from "@colyseus/core";

const __dirname = path.resolve();

// Define the source constant for logging
const LOGGER_SOURCE = "🚪🎮";

// Define the type for the world file structure
interface WorldPlanetDefinition {
  name: string;
  x: number;
  y: number;
}

// Define the server control modes (mirror client)
type ServerControlMode = "run" | "step" | "pause";

export class GameRoom extends Room<InstanceType<typeof RoomState>> {
  // Max clients default
  maxClients = MAX_PLAYERS;

  // Store the loaded world data
  private worldPlanets: WorldPlanetDefinition[] = [];

  // Add physics manager instance
  private physicsManager!: ServerPhysicsManager;

  // Add property to hold the interval ID
  private physicsLoopInterval: NodeJS.Timeout | null = null;

  // Use shared constant for timestep
  private readonly physicsTimeStep = PHYSICS_TIMESTEP_MS;

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
  private lastBroadcastState: {
    [sessionId: string]: Partial<InstanceType<typeof PlayerState>>;
  } = {};

  // Add state for server control
  private serverControlMode: ServerControlMode = "run";
  private stepRequested: boolean = false;

  onCreate(options: any) {
    Logger.debug(LOGGER_SOURCE, `onCreate called for room ${this.roomId}`);
    Logger.info(
      LOGGER_SOURCE,
      `Room ${this.roomId} created with options:`,
      options
    );

    // Initialize the physics manager
    Logger.debug(
      LOGGER_SOURCE,
      "onCreate: Initializing ServerPhysicsManager..."
    );
    this.physicsManager = new ServerPhysicsManager();
    Logger.info(LOGGER_SOURCE, "ServerPhysicsManager initialized.");
    Logger.debug(LOGGER_SOURCE, "onCreate: ServerPhysicsManager initialized.");

    // Initialize the game state
    Logger.debug(LOGGER_SOURCE, "onCreate: Initializing RoomState...");
    this.state = new RoomState();
    Logger.info(LOGGER_SOURCE, "GameState initialized.");
    Logger.debug(LOGGER_SOURCE, "onCreate: RoomState initialized.");

    // --- Populate Player Configuration --- //
    Logger.debug(LOGGER_SOURCE, "onCreate: Populating playerConfig...");
    this.state.playerConfig.mass = PLAYER_MASS;
    this.state.playerConfig.friction = PLAYER_FRICTION;
    this.state.playerConfig.frictionAir = PLAYER_FRICTION_AIR;
    this.state.playerConfig.restitution = PLAYER_RESTITUTION;
    this.state.playerConfig.collisionCategory = CollisionCategory.ROCKET;
    this.state.playerConfig.collisionMask =
      CollisionCategory.GROUND | CollisionCategory.ROCKET; // Collide with Ground and Players

    // Convert and add vertices
    rocketVertices.forEach((v) => {
      this.state.playerConfig.vertices.push(new VectorSchema().assign(v));
    });
    Logger.info(LOGGER_SOURCE, "Player configuration populated in state.");

    // --- Load World Definition ---
    Logger.debug(
      LOGGER_SOURCE,
      "onCreate: Attempting to load world definition..."
    );
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
      Logger.debug(LOGGER_SOURCE, "onCreate: World definition load failed.");
    }

    // --- Initialize Planets from World Data ---
    Logger.debug(
      LOGGER_SOURCE,
      `onCreate: Initializing planets from world data (${this.worldPlanets.length} found)...`
    );
    if (this.worldPlanets.length > 0) {
      this.worldPlanets.forEach(
        (worldPlanet: WorldPlanetDefinition, index: number) => {
          Logger.debug(
            LOGGER_SOURCE,
            `onCreate: Initializing planet ${index + 1}/${
              this.worldPlanets.length
            }: ${worldPlanet.name}`
          );
          const basePlanetData = generatePlanetDataFromName(worldPlanet.name);
          Logger.debug(
            LOGGER_SOURCE,
            `... generated base data for ${worldPlanet.name}`
          );
          // Assign properties excluding colors and noiseParams first
          const planetState = new PlanetData().assign({
            id: worldPlanet.name,
            x: worldPlanet.x,
            y: worldPlanet.y,
            radius: basePlanetData.radius,
            mass: basePlanetData.mass,
            atmosphereHeight:
              basePlanetData.atmosphereHeight ?? DEFAULT_ATMOSPHERE_HEIGHT,
            surfaceDensity: basePlanetData.surfaceDensity,
            seed: worldPlanet.name, // Use name as seed for consistency
          });

          // Assign colors and noiseParams properties to the *existing* nested schema instances
          planetState.colors.assign({
            base: basePlanetData.colors.base,
            accent1:
              basePlanetData.colors.accent1 ?? basePlanetData.colors.base,
            accent2:
              basePlanetData.colors.accent2 ?? basePlanetData.colors.base,
          });
          planetState.noiseParams.assign({
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
          Logger.debug(
            LOGGER_SOURCE,
            `onCreate: Finished initializing planet ${worldPlanet.name}`
          );
        }
      );
      Logger.debug(
        LOGGER_SOURCE,
        "onCreate: Finished initializing all planets."
      );
    } else {
      Logger.warn(
        LOGGER_SOURCE,
        "No planets loaded from world file, starting with empty planet state."
      );
    }

    // --- Setup Message Handlers ---
    this.onMessage("*", (client, type, message) => {
      // Handle specific messages here
      switch (type) {
        case "ping":
          // Immediately send back the original timestamp for RTT calculation
          client.send("pong", message);
          Logger.trace(LOGGER_SOURCE, `Sent pong to ${client.sessionId}`);
          break;
        // Add other message handlers as needed
        default:
          // Only log if we intend to handle it later, otherwise ignore
          // Logger.trace(
          //   LOGGER_SOURCE,
          //   `Received unhandled message type "${type}" from ${client.sessionId}:`,
          //   message,
          // );
          break;
      }
    });

    // Initialize last update time before starting loop
    Logger.debug(
      LOGGER_SOURCE,
      "onCreate: Initializing physics loop variables..."
    );
    this.lastPhysicsUpdateTime = Date.now();
    this.accumulator = 0;
    Logger.debug(
      LOGGER_SOURCE,
      `onCreate: lastPhysicsUpdateTime=${this.lastPhysicsUpdateTime}, accumulator=${this.accumulator}`
    );

    // Start the physics update loop with accumulation logic
    Logger.debug(
      LOGGER_SOURCE,
      "onCreate: Starting physics update loop (setInterval)..."
    );
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
        let performUpdate = true; // Flag to control if physics update runs

        // --- Server Control Logic ---
        if (this.serverControlMode === "pause") {
          if (this.stepRequested) {
            // If stepping, allow one update and reset the flag
            this.stepRequested = false;
            Logger.trace(LOGGER_SOURCE, "Performing single step.");
            // performUpdate remains true
          } else {
            // If paused and not stepping, skip the update
            performUpdate = false;
            // Logger.trace(LOGGER_SOURCE, "Physics paused, skipping update."); // Optional: Log pause skipping
          }
        }
        // --- End Server Control Logic ---

        if (performUpdate) {
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
            if (
              Math.abs(playerBody.angularVelocity) >
              ANGULAR_VELOCITY_SNAP_THRESHOLD
            ) {
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

          // Broadcast updated physics state using delta compression
          const currentPlayerStates: {
            [sessionId: string]: Partial<InstanceType<typeof PlayerState>>;
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
          const deltaState: {
            [sessionId: string]: Partial<InstanceType<typeof PlayerState>>;
          } = {};
          for (const sessionId in currentPlayerStates) {
            const currentState = currentPlayerStates[sessionId];
            const lastState = this.lastBroadcastState[sessionId];
            const playerDelta: Partial<InstanceType<typeof PlayerState>> = {};
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
          // --- End Broadcast --- //
        } // End if(performUpdate)

        // Always consume time from the accumulator for this potential step
        this.accumulator -= this.physicsTimeStep;
      }
    }, this.physicsTimeStep); // Interval still runs at target rate
    Logger.info(
      LOGGER_SOURCE,
      `Started physics loop with accumulation logic at ${this.physicsTimeStep.toFixed(
        2
      )}ms interval.`
    );

    Logger.debug(LOGGER_SOURCE, "onCreate: Registering message handlers...");
    // Register message handlers
    this.onMessage(
      "updateState",
      (client, message: Partial<InstanceType<typeof PlayerState>>) => {
        Logger.debug(
          LOGGER_SOURCE,
          `onMessage: Received 'updateState' from ${client.sessionId}`,
          message
        );
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
      }
    );

    // Register the message handler for player input
    this.onMessage<PlayerInputMessage>("player_input", (client, message) => {
      Logger.debug(
        LOGGER_SOURCE,
        `onMessage: Received 'player_input' from ${client.sessionId}`,
        message
      );
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

    // --- ADDED: Handler for Server Control Mode ---
    this.onMessage<ServerControlMode>(
      "setServerControlMode",
      (client, mode) => {
        Logger.debug(
          LOGGER_SOURCE,
          `Received setServerControlMode from ${client.sessionId}: ${mode}`
        );

        if (mode === "run" || mode === "pause" || mode === "step") {
          // Check if switching back to 'run' from a paused state
          if (mode === "run" && this.serverControlMode !== "run") {
            Logger.info(
              LOGGER_SOURCE,
              "Resuming physics loop, resetting time."
            );
            this.lastPhysicsUpdateTime = Date.now(); // Reset time to prevent jump
            this.accumulator = 0; // Reset accumulator
          }

          if (mode === "step") {
            if (this.serverControlMode === "pause") {
              Logger.debug(LOGGER_SOURCE, "Requesting single physics step.");
              this.stepRequested = true;
              // Don't change serverControlMode, stays paused until next step or run
            } else {
              Logger.warn(
                LOGGER_SOURCE,
                "Step requested but server is not paused. Ignoring."
              );
            }
          } else {
            // For 'run' or 'pause', just set the mode
            this.serverControlMode = mode;
            Logger.debug(LOGGER_SOURCE, `Server control mode set to: ${mode}`);
          }
        } else {
          Logger.warn(
            LOGGER_SOURCE,
            `Invalid server control mode received: ${mode}`
          );
        }
      }
    );
    // --- END Handler for Server Control Mode ---

    // --- ADDED: Ping/Pong Handler ---
    this.onMessage<number>("ping", (client, message) => {
      // Immediately send back a pong message to the specific client
      // Echo the original timestamp number to allow the client to calculate RTT
      client.send("pong", message);
      // Optional: Log ping reception if needed for debugging
      // Logger.trace(LOGGER_SOURCE, `Received ping number ${message} from ${client.sessionId}, sending pong.`);
    });
    // --- END Ping/Pong Handler ---

    Logger.info(LOGGER_SOURCE, "Message handlers registered.");
    Logger.debug(LOGGER_SOURCE, `onCreate finished for room ${this.roomId}`);
  }

  onJoin(client: Client, options: any) {
    Logger.debug(
      LOGGER_SOURCE,
      `onJoin: ${client.sessionId} attempting to join.`
    );
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
          (firstPlanetState.atmosphereHeight ?? DEFAULT_ATMOSPHERE_HEIGHT) +
          INITIAL_ORBITAL_BUFFER;
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
        player.x = options.startX ?? Math.random() * DEFAULT_SPAWN_AREA_SIZE;
        player.y = options.startY ?? Math.random() * DEFAULT_SPAWN_AREA_SIZE;
        player.angle = 0;
      }
    } else {
      Logger.warn(
        LOGGER_SOURCE,
        `No planets defined in world file! Placing player at default.`
      );
      player.x = options.startX ?? Math.random() * DEFAULT_SPAWN_AREA_SIZE;
      player.y = options.startY ?? Math.random() * DEFAULT_SPAWN_AREA_SIZE;
      player.angle = 0;
    }
    player.cargo = "";

    // Create the player's physics body using Matter.js and config from state
    const config = this.state.playerConfig;
    // Convert ArraySchema<VectorSchema> back to Array<{x,y}> for Matter
    const bodyVertices = Array.from(config.vertices).map((v) => ({
      x: v.x,
      y: v.y,
    }));

    const playerBody = Matter.Bodies.fromVertices(
      player.x,
      player.y,
      [bodyVertices], // Use converted vertices (still needs wrapping?)
      {
        mass: config.mass,
        friction: config.friction,
        frictionAir: config.frictionAir,
        restitution: config.restitution,
        label: `player-${client.sessionId}`, // Changed label prefix
        collisionFilter: {
          category: config.collisionCategory,
          mask: config.collisionMask,
        },
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

    // Send initial world creation time using Date.now()
    client.send("worldCreationTime", Date.now());
    Logger.info(
      LOGGER_SOURCE,
      `Sent world creation time to ${client.sessionId}`
    );

    // --- REGISTER MESSAGE HANDLERS FOR THIS CLIENT --- //

    // Handler for player input
    this.onMessage<PlayerInputMessage>("playerInput", (client, message) => {
      // Validate player exists
      const playerBody = this.playerBodies.get(client.sessionId);
      if (!playerBody) {
        Logger.warn(
          LOGGER_SOURCE,
          `Input received for unknown player body: ${client.sessionId}`
        );
        return;
      }

      // Process based on the specific input type
      switch (message.input) {
        case "thrust_start":
          this.playerThrustState.set(client.sessionId, true);
          // Logger.trace(`Thrust started for ${client.sessionId}`);
          break;
        case "thrust_stop":
          this.playerThrustState.set(client.sessionId, false);
          // Logger.trace(`Thrust stopped for ${client.sessionId}`);
          break;
        case "set_angle":
          if (typeof message.value === "number" && !isNaN(message.value)) {
            // Directly set the angle based on client input
            // Manual angle wrapping to stay within -PI to PI
            let targetAngle = message.value;
            while (targetAngle <= -Math.PI) {
              targetAngle += 2 * Math.PI;
            }
            while (targetAngle > Math.PI) {
              targetAngle -= 2 * Math.PI;
            }
            Matter.Body.setAngle(playerBody, targetAngle);
            // Logger.trace(`Set angle to ${targetAngle.toFixed(2)} for ${client.sessionId}`);
          } else {
            Logger.warn(
              LOGGER_SOURCE,
              `Invalid value received for set_angle from ${client.sessionId}: ${message.value}`
            );
          }
          break;
        default:
          // Log unknown input types using type assertion for safety
          Logger.warn(
            LOGGER_SOURCE,
            `Unknown player input type: ${(message as any)?.input}`
          );
          break;
      }

      // Log the processed input
      // Logger.trace(
      //   LOGGER_SOURCE,
      //   `Processed input from ${client.sessionId}: seq=${message.seq}, input=${message.input}, value=${message.value}`
      // );
    });

    // Add handlers for other message types here (e.g., chat, actions)

    Logger.debug(
      LOGGER_SOURCE,
      `Registered message handlers for ${client.sessionId}`
    );

    Logger.debug(
      LOGGER_SOURCE,
      `onJoin: ${client.sessionId} finished joining.`
    );
  }

  onLeave(client: Client, consented: boolean) {
    Logger.debug(
      LOGGER_SOURCE,
      `onLeave: ${client.sessionId} attempting to leave. Consented: ${consented}`
    );
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
    Logger.debug(
      LOGGER_SOURCE,
      `onLeave: ${client.sessionId} finished leaving.`
    );
  }

  onDispose() {
    Logger.debug(LOGGER_SOURCE, `onDispose called for room ${this.roomId}`);
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
    Logger.debug(LOGGER_SOURCE, `onDispose finished for room ${this.roomId}`);
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
