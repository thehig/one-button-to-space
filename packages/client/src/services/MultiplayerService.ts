import * as Colyseus from "colyseus.js";
// Import the configuration file
import { config } from "@one-button-to-space/shared";
// Import the state schema definitions
import { RoomState, PlayerState, PlanetData } from "../schema/State"; // PlanetData now includes config
import { Logger, LogLevel } from "@one-button-to-space/shared"; // Updated path
// Import Player Input type
import { PlayerInputMessage } from "@one-button-to-space/shared"; // Add this import

// Define the source constant for logging
const LOGGER_SOURCE = "🌐🤝"; // Replaced string with emojis

// Define types for status and listener callback
export type ConnectionStatus =
  | "disconnected"
  | "connecting"
  | "connected"
  | "error";
export type StatusListener = (status: ConnectionStatus) => void;
// Define callback types for player state changes
export type PlayerAddListener = (playerId: string, state: PlayerState) => void;
export type PlayerUpdateListener = (
  playerId: string,
  state: PlayerState
) => void;
export type PlayerRemoveListener = (playerId: string) => void;
// Define callback types for planet state changes
export type PlanetAddListener = (planetId: string, data: PlanetData) => void;
export type PlanetUpdateListener = (planetId: string, data: PlanetData) => void;
export type PlanetRemoveListener = (planetId: string) => void;
// Define callback type for physics updates
export type PhysicsUpdateListener = (
  updateData: { [sessionId: string]: Partial<PlayerState> } // Type for the broadcasted data
) => void;

// --- MPS Calculation Constants ---
const MPS_SAMPLE_SIZE = 60; // Number of intervals to average for MPS
const PING_INTERVAL_MS = 2000; // Send ping every 2 seconds

export class MultiplayerService {
  private client: Colyseus.Client | null = null;
  // Use the imported RoomState type
  private room: Colyseus.Room<RoomState> | null = null;
  // private connectionStatus: 'disconnected' | 'connecting' | 'connected' | 'error' = 'disconnected'; // Use type alias
  private connectionStatus: ConnectionStatus = "disconnected";
  // Remove hardcoded defaults, they will be loaded from config
  // private serverUrl = "ws://localhost:2567";
  // private roomName = "game_room";
  private serverUrl: string;
  private roomName: string;
  // Array to hold status listeners
  private statusListeners: StatusListener[] = [];
  // Local cache of player states
  private players: Map<string, PlayerState> = new Map();
  // Local cache of planet states
  private planets: Map<string, PlanetData> = new Map();
  // Listeners for player state changes
  private playerAddListeners: PlayerAddListener[] = [];
  private playerUpdateListeners: PlayerUpdateListener[] = [];
  private playerRemoveListeners: PlayerRemoveListener[] = [];
  // Listeners for planet state changes
  private planetAddListeners: PlanetAddListener[] = [];
  private planetUpdateListeners: PlanetUpdateListener[] = [];
  private planetRemoveListeners: PlanetRemoveListener[] = [];
  // Listeners for physics updates
  private physicsUpdateListeners: PhysicsUpdateListener[] = [];

  // --- MPS Calculation Properties ---
  private messageTimestamps: number[] = [];
  private currentMps: number = 0;
  private lastMessageTime: number = 0;

  // --- ADDED: OMPS Calculation Properties ---
  private outputMessageTimestamps: number[] = [];
  private currentOmps: number = 0;
  private lastOutputMessageTime: number = 0;

  // --- ADDED: Ping/RTT Properties ---
  private pingIntervalId: NodeJS.Timeout | null = null;
  private pingStartTime: number = 0; // 0 indicates no ping in flight
  private currentRtt: number = 0;

  constructor() {
    Logger.info(LOGGER_SOURCE, "MultiplayerService instantiated."); // Use constant
    // Load configuration
    this.serverUrl = config.multiplayer.serverUrl;
    this.roomName = config.multiplayer.roomName;
    Logger.info(
      // Use constant
      LOGGER_SOURCE,
      `MultiplayerService configured: Server=${this.serverUrl}, Room=${this.roomName}`
    );
    // TODO: Add fallback if config loading fails?
    this.currentMps = 0;
    this.lastMessageTime = 0;
    this.messageTimestamps = [];
    // Initialize OMPS values
    this.currentOmps = 0;
    this.lastOutputMessageTime = 0;
    this.outputMessageTimestamps = [];
    // Initialize RTT values
    this.pingStartTime = 0;
    this.currentRtt = 0;
  }

  public async connect(): Promise<void> {
    if (
      this.connectionStatus === "connected" ||
      this.connectionStatus === "connecting"
    ) {
      Logger.debug(
        // Use constant
        LOGGER_SOURCE,
        "MultiplayerService: Already connected or connecting."
      );
      return;
    }

    // Use private method to set status and notify listeners
    this.setConnectionStatus("connecting");
    Logger.info(
      // Use constant
      LOGGER_SOURCE,
      `MultiplayerService: Connecting to ${this.serverUrl}...`
    );
    // TODO: Notify status listeners -- Handled by setConnectionStatus

    try {
      this.client = new Colyseus.Client(this.serverUrl);
      Logger.info(
        // Use constant
        LOGGER_SOURCE,
        `MultiplayerService: Attempting to join or create room '${this.roomName}'...`
      );

      // Use the specific RoomState type
      this.room = await this.client.joinOrCreate<RoomState>(this.roomName);

      // Use private method to set status and notify listeners
      this.setConnectionStatus("connected");
      Logger.info(
        // Use constant
        LOGGER_SOURCE,
        `MultiplayerService: Successfully joined room '${this.roomName}' with session ID: ${this.room.sessionId}`
      );
      // TODO: Notify status listeners -- Handled by setConnectionStatus

      this.setupRoomListeners();
      this.startPingLoop(); // Start ping loop on successful connection
    } catch (e) {
      // Use private method to set status and notify listeners
      this.setConnectionStatus("error");
      console.error("MultiplayerService: Connection/Join failed:", e);
      // TODO: Notify status listeners -- Handled by setConnectionStatus
      this.room = null;
      this.client = null; // Clear client on error
      // TODO: Implement reconnection logic?
    }
  }

  public disconnect(): void {
    if (!this.client && !this.room) {
      Logger.debug(LOGGER_SOURCE, "MultiplayerService: Already disconnected."); // Use constant
      return;
    }

    if (this.room) {
      Logger.info(LOGGER_SOURCE, "MultiplayerService: Leaving room..."); // Use constant
      this.room.leave(false); // Pass false to prevent immediate client disconnect if desired, though we null client anyway
      this.room = null;
    }
    // Note: Colyseus client doesn't have an explicit disconnect. Leaving the room handles it.
    // Client might still exist after room leave, so explicitly null it.
    this.client = null;
    const oldStatus = this.connectionStatus;
    // Use private method to set status and notify listeners
    this.setConnectionStatus("disconnected");
    Logger.info(LOGGER_SOURCE, "MultiplayerService: Disconnected."); // Use constant
    // Notification handled by setConnectionStatus
    // if (oldStatus !== 'disconnected') {
    //    // TODO: Notify status listeners
    // }
    // Reset MPS tracking on leave
    this.currentMps = 0;
    this.lastMessageTime = 0;
    this.messageTimestamps = [];
    // Reset OMPS tracking on leave
    this.currentOmps = 0;
    this.lastOutputMessageTime = 0;
    this.outputMessageTimestamps = [];
    // Stop ping loop and reset RTT on disconnect
    this.stopPingLoop();
    this.pingStartTime = 0;
    this.currentRtt = 0;
  }

  public isConnected(): boolean {
    // Check both status and if room object exists
    return this.connectionStatus === "connected" && !!this.room;
  }

  public getConnectionStatus(): ConnectionStatus {
    return this.connectionStatus;
  }

  /**
   * Returns the session ID of the current client in the room.
   * @returns string | undefined
   */
  public getSessionId(): string | undefined {
    return this.room?.sessionId;
  }

  // --- Listener Management ---
  public addStatusListener(listener: StatusListener): void {
    if (!this.statusListeners.includes(listener)) {
      this.statusListeners.push(listener);
      Logger.debug(LOGGER_SOURCE, "MultiplayerService: Status listener added."); // Use constant
      // Optionally, immediately notify the new listener with the current status
      // listener(this.connectionStatus);
    }
  }

  public removeStatusListener(listener: StatusListener): void {
    const index = this.statusListeners.indexOf(listener);
    if (index !== -1) {
      this.statusListeners.splice(index, 1);
      Logger.debug(
        LOGGER_SOURCE,
        "MultiplayerService: Status listener removed."
      ); // Use constant
    }
  }

  private notifyStatusListeners(status: ConnectionStatus): void {
    Logger.debug(
      // Use constant
      LOGGER_SOURCE,
      `MultiplayerService: Notifying listeners of status: ${status}`
    );
    // Use slice() to iterate over a copy, in case listeners remove themselves during notification
    this.statusListeners.slice().forEach((listener) => {
      try {
        listener(status);
      } catch (error) {
        console.error("MultiplayerService: Error in status listener:", error);
        // Optionally remove the faulty listener?
        // this.removeStatusListener(listener);
      }
    });
  }

  // Private helper to set status and notify
  private setConnectionStatus(status: ConnectionStatus): void {
    if (this.connectionStatus !== status) {
      this.connectionStatus = status;
      this.notifyStatusListeners(status);
    }
  }
  // --- End Listener Management ---

  // --- Listener Management (Player State) ---
  public addPlayerAddListener(listener: PlayerAddListener): void {
    if (!this.playerAddListeners.includes(listener)) {
      this.playerAddListeners.push(listener);
    }
  }

  public removePlayerAddListener(listener: PlayerAddListener): void {
    const index = this.playerAddListeners.indexOf(listener);
    if (index !== -1) this.playerAddListeners.splice(index, 1);
  }

  public addPlayerUpdateListener(listener: PlayerUpdateListener): void {
    if (!this.playerUpdateListeners.includes(listener)) {
      this.playerUpdateListeners.push(listener);
    }
  }

  public removePlayerUpdateListener(listener: PlayerUpdateListener): void {
    const index = this.playerUpdateListeners.indexOf(listener);
    if (index !== -1) this.playerUpdateListeners.splice(index, 1);
  }

  public addPlayerRemoveListener(listener: PlayerRemoveListener): void {
    if (!this.playerRemoveListeners.includes(listener)) {
      this.playerRemoveListeners.push(listener);
    }
  }

  public removePlayerRemoveListener(listener: PlayerRemoveListener): void {
    const index = this.playerRemoveListeners.indexOf(listener);
    if (index !== -1) this.playerRemoveListeners.splice(index, 1);
  }

  private notifyPlayerAdded(playerId: string, state: PlayerState): void {
    Logger.debug(
      LOGGER_SOURCE,
      `MultiplayerService: Notifying Player Added: ${playerId}`
    ); // Use constant
    this.playerAddListeners.slice().forEach((listener) => {
      try {
        listener(playerId, state);
      } catch (error) {
        console.error(
          "MultiplayerService: Error in player add listener:",
          error
        );
      }
    });
  }

  private notifyPlayerUpdated(playerId: string, state: PlayerState): void {
    Logger.trace(
      LOGGER_SOURCE,
      `MultiplayerService: Notifying Player Updated: ${playerId}`
    );
    this.playerUpdateListeners.slice().forEach((listener) => {
      try {
        listener(playerId, state);
      } catch (error) {
        console.error(
          "MultiplayerService: Error in player update listener:",
          error
        );
      }
    });
  }

  private notifyPlayerRemoved(playerId: string): void {
    Logger.debug(
      LOGGER_SOURCE,
      `MultiplayerService: Notifying Player Removed: ${playerId}`
    ); // Replaced console.log
    this.playerRemoveListeners.slice().forEach((listener) => {
      try {
        listener(playerId);
      } catch (error) {
        console.error(
          "MultiplayerService: Error in player remove listener:",
          error
        );
      }
    });
  }
  // --- End Listener Management (Player State) ---

  // --- Listener Management (Planet State) ---
  public addPlanetAddListener(listener: PlanetAddListener): void {
    if (!this.planetAddListeners.includes(listener)) {
      this.planetAddListeners.push(listener);
    }
  }

  public removePlanetAddListener(listener: PlanetAddListener): void {
    const index = this.planetAddListeners.indexOf(listener);
    if (index !== -1) this.planetAddListeners.splice(index, 1);
  }

  public addPlanetUpdateListener(listener: PlanetUpdateListener): void {
    if (!this.planetUpdateListeners.includes(listener)) {
      this.planetUpdateListeners.push(listener);
    }
  }

  public removePlanetUpdateListener(listener: PlanetUpdateListener): void {
    const index = this.planetUpdateListeners.indexOf(listener);
    if (index !== -1) this.planetUpdateListeners.splice(index, 1);
  }

  public addPlanetRemoveListener(listener: PlanetRemoveListener): void {
    if (!this.planetRemoveListeners.includes(listener)) {
      this.planetRemoveListeners.push(listener);
    }
  }

  public removePlanetRemoveListener(listener: PlanetRemoveListener): void {
    const index = this.planetRemoveListeners.indexOf(listener);
    if (index !== -1) this.planetRemoveListeners.splice(index, 1);
  }

  private notifyPlanetAdded(planetId: string, data: PlanetData): void {
    Logger.debug(
      LOGGER_SOURCE,
      `MultiplayerService: Notifying Planet Added: ${planetId}`
    ); // Replaced console.log
    this.planetAddListeners.slice().forEach((listener) => {
      try {
        listener(planetId, { ...data } as PlanetData); // Send a copy
      } catch (error) {
        console.error(
          "MultiplayerService: Error in planet add listener:",
          error
        );
      }
    });
  }

  private notifyPlanetUpdated(planetId: string, data: PlanetData): void {
    Logger.trace(
      LOGGER_SOURCE,
      `MultiplayerService: Notifying Planet Updated: ${planetId}`
    );
    this.planetUpdateListeners.slice().forEach((listener) => {
      try {
        listener(planetId, { ...data } as PlanetData); // Send a copy
      } catch (error) {
        console.error(
          "MultiplayerService: Error in planet update listener:",
          error
        );
      }
    });
  }

  private notifyPlanetRemoved(planetId: string): void {
    Logger.debug(
      LOGGER_SOURCE,
      `MultiplayerService: Notifying Planet Removed: ${planetId}`
    ); // Replaced console.log
    this.planetRemoveListeners.slice().forEach((listener) => {
      try {
        listener(planetId);
      } catch (error) {
        console.error(
          "MultiplayerService: Error in planet remove listener:",
          error
        );
      }
    });
  }
  // --- End Listener Management (Planet State) ---

  // --- Listener Management (Physics Update) ---
  public addPhysicsUpdateListener(listener: PhysicsUpdateListener): void {
    if (!this.physicsUpdateListeners.includes(listener)) {
      this.physicsUpdateListeners.push(listener);
    }
  }

  public removePhysicsUpdateListener(listener: PhysicsUpdateListener): void {
    const index = this.physicsUpdateListeners.indexOf(listener);
    if (index !== -1) this.physicsUpdateListeners.splice(index, 1);
  }

  private notifyPhysicsUpdateListeners(updateData: {
    [sessionId: string]: Partial<PlayerState>;
  }): void {
    Logger.debug(
      LOGGER_SOURCE,
      `MultiplayerService: Notifying Physics Update: ${
        Object.keys(updateData).length
      } players`
    );
    this.physicsUpdateListeners.slice().forEach((listener) => {
      try {
        listener(updateData);
      } catch (error) {
        console.error(
          "MultiplayerService: Error in physics update listener:",
          error
        );
      }
    });
  }

  // --- End Listener Management (Physics Update) ---

  // --- State Getters ---
  public getAllPlayersState(): Map<string, PlayerState> {
    // Return a copy to prevent external modification of the internal cache
    return new Map(this.players);
  }

  public getAllPlanetsState(): Map<string, PlanetData> {
    // Return a copy
    return new Map(this.planets);
  }

  // --- End State Getters ---

  public sendPlayerState(state: Partial<PlayerState>): void {
    if (!this.isConnected()) {
      Logger.warn(
        LOGGER_SOURCE,
        "MultiplayerService: Cannot send state, not connected."
      ); // Use constant
      return;
    }
    // Basic validation (can be expanded)
    if (
      typeof state.x !== "number" ||
      typeof state.y !== "number" ||
      typeof state.angle !== "number"
    ) {
      Logger.warn(
        LOGGER_SOURCE,
        "MultiplayerService: Attempted to send invalid state:",
        state
      ); // Use constant
      return;
    }
    try {
      // Logger.debug(LOGGER_SOURCE, 'MultiplayerService: Sending player state:', state); // Use constant, maybe too verbose
      this.room?.send("updateState", state);
    } catch (error) {
      console.error("MultiplayerService: Failed to send player state:", error);
      // TODO: Handle error (e.g., notify user, attempt retry?)
    }
  }

  /**
   * Sends a single player input message to the server.
   * @param inputMessage The PlayerInputMessage object to send.
   */
  public sendPlayerInput(inputMessage: PlayerInputMessage): void {
    if (!this.isConnected()) {
      Logger.warn(
        LOGGER_SOURCE,
        "MultiplayerService: Cannot send input, not connected."
      );
      return;
    }
    // TODO: Add validation for the inputMessage structure?
    // Log the input being sent for debugging
    Logger.trace(LOGGER_SOURCE, "Sending player_input:", inputMessage); // Logger call

    try {
      // Type for the message being sent
      this.room?.send("player_input", inputMessage);
      this.updateOmpsCounter(); // Track outgoing message
    } catch (error) {
      console.error("MultiplayerService: Failed to send player input:", error);
      // TODO: Handle error
    }
  }

  public getMps(): number {
    // Simply return the calculated value. The calculation is done in updateMpsCounter.
    return this.currentMps;
  }

  // --- ADDED: Public getter for OMPS ---
  public getOmps(): number {
    // Simply return the calculated value. The calculation is done in updateOmpsCounter.
    return this.currentOmps;
  }

  // --- ADDED: Public getter for RTT ---
  public getRtt(): number {
    return this.currentRtt;
  }

  // --- Centralized MPS Counter Update ---
  private updateMpsCounter(): void {
    const now = Date.now();
    if (this.lastMessageTime > 0) {
      const interval = now - this.lastMessageTime;
      this.messageTimestamps.push(interval);
      if (this.messageTimestamps.length > MPS_SAMPLE_SIZE) {
        this.messageTimestamps.shift(); // Remove oldest
      }

      if (this.messageTimestamps.length > 0) {
        const totalInterval = this.messageTimestamps.reduce((a, b) => a + b, 0);
        const avgInterval = totalInterval / this.messageTimestamps.length;
        this.currentMps = avgInterval > 0 ? 1000 / avgInterval : 0;
      } else {
        this.currentMps = 0;
      }
    }
    this.lastMessageTime = now;
  }

  // --- ADDED: Centralized OMPS Counter Update ---
  private updateOmpsCounter(): void {
    const now = Date.now();
    if (this.lastOutputMessageTime > 0) {
      const interval = now - this.lastOutputMessageTime;
      this.outputMessageTimestamps.push(interval);
      if (this.outputMessageTimestamps.length > MPS_SAMPLE_SIZE) {
        this.outputMessageTimestamps.shift(); // Remove oldest
      }

      if (this.outputMessageTimestamps.length > 0) {
        const totalInterval = this.outputMessageTimestamps.reduce(
          (a, b) => a + b,
          0
        );
        const avgInterval = totalInterval / this.outputMessageTimestamps.length;
        this.currentOmps = avgInterval > 0 ? 1000 / avgInterval : 0;
        // Optional: Add debug log if needed
        // Logger.debug(LOGGER_SOURCE, `OMPS Calc: timestamps=${this.outputMessageTimestamps.length}, avgInterval=${avgInterval.toFixed(2)}, currentOmps=${this.currentOmps.toFixed(2)}`);
      } else {
        this.currentOmps = 0;
      }
    }
    this.lastOutputMessageTime = now;
  }

  // --- ADDED: Ping/Pong Methods ---
  private startPingLoop(): void {
    this.stopPingLoop(); // Ensure no existing loop is running
    Logger.info(
      LOGGER_SOURCE,
      `Starting ping loop (interval: ${PING_INTERVAL_MS}ms)`
    );
    this.pingIntervalId = setInterval(() => {
      this.sendPing();
    }, PING_INTERVAL_MS);
  }

  private stopPingLoop(): void {
    if (this.pingIntervalId) {
      clearInterval(this.pingIntervalId);
      this.pingIntervalId = null;
      Logger.info(LOGGER_SOURCE, "Stopped ping loop.");
    }
  }

  private sendPing(): void {
    if (!this.isConnected() || this.pingStartTime !== 0) {
      // Don't send if not connected or if a ping is already in flight
      if (this.pingStartTime !== 0) {
        Logger.warn(
          LOGGER_SOURCE,
          "Skipping ping send, previous ping still in flight."
        );
      }
      return;
    }

    this.pingStartTime = Date.now();
    try {
      // Logger.debug(LOGGER_SOURCE, `Sending ping with timestamp: ${this.pingStartTime}`);
      this.room?.send("ping", { timestamp: this.pingStartTime });
    } catch (error) {
      console.error("MultiplayerService: Failed to send ping:", error);
      this.pingStartTime = 0; // Reset start time on send error
    }
  }

  private handlePong(message: { timestamp: number }): void {
    // Logger.debug(LOGGER_SOURCE, "Received pong:", message);
    if (message.timestamp === this.pingStartTime && this.pingStartTime !== 0) {
      this.currentRtt = Date.now() - this.pingStartTime;
      // Logger.debug(LOGGER_SOURCE, `Calculated RTT: ${this.currentRtt}ms`);
      this.pingStartTime = 0; // Reset, ready for next ping
    } else {
      Logger.warn(
        LOGGER_SOURCE,
        `Received pong with mismatched or invalid timestamp. PongTs: ${message.timestamp}, StartTs: ${this.pingStartTime}`
      );
      // Optionally reset pingStartTime here too if a mismatched pong means the original is lost
      // this.pingStartTime = 0;
    }
  }
  // --- END Ping/Pong Methods ---

  private setupRoomListeners(): void {
    if (!this.room) {
      console.error(
        "MultiplayerService: Cannot set up listeners, room is null."
      );
      return;
    }

    Logger.info(
      // Use constant
      LOGGER_SOURCE,
      "Setting up room listeners (onStateChange, onError, onLeave)..."
    );

    // Listener for the entire state synchronization - THIS WILL HANDLE EVERYTHING
    this.room.onStateChange((state: RoomState) => {
      this.updateMpsCounter(); // Track message receipt
      Logger.trace(LOGGER_SOURCE, "Received full state update."); // This one should stay trace

      // --- Player Sync (Full State Check) ---
      if (state.players) {
        // Use state.players.forEach directly - assumes it behaves like MapSchema/Map
        const incomingPlayerIds = new Set<string>();
        state.players.forEach((playerState: PlayerState, playerId: string) => {
          incomingPlayerIds.add(playerId);
        });

        const localPlayerIds = new Set(this.players.keys());

        // Check for removed players
        localPlayerIds.forEach((playerId) => {
          if (!incomingPlayerIds.has(playerId)) {
            Logger.debug(LOGGER_SOURCE, `Player left: ${playerId}`); // Restore to debug
            this.players.delete(playerId);
            this.notifyPlayerRemoved(playerId);
          }
        });

        // Check for added/updated players
        state.players.forEach((playerState: PlayerState, playerId: string) => {
          // Basic check if playerState seems valid before processing
          if (
            typeof playerState?.x !== "number" ||
            typeof playerState?.y !== "number"
          ) {
            console.warn(
              `Skipping invalid player state data for ID: ${playerId}`
            );
            return;
          }

          if (!localPlayerIds.has(playerId)) {
            Logger.debug(LOGGER_SOURCE, `Player joined: ${playerId}`); // Restore to debug
            const clonedState = { ...playerState } as PlayerState;
            this.players.set(playerId, clonedState);
            this.notifyPlayerAdded(playerId, clonedState);
          } else {
            const localPlayer = this.players.get(playerId);
            // Basic check for update - consider deep comparison if needed
            if (JSON.stringify(localPlayer) !== JSON.stringify(playerState)) {
              const clonedState = { ...playerState } as PlayerState;
              this.players.set(playerId, clonedState);
              this.notifyPlayerUpdated(playerId, clonedState);
            }
          }
        });
      } else {
        // Handle case where players map disappears
        if (this.players.size > 0) {
          Logger.warn(
            // Use constant
            LOGGER_SOURCE,
            "Players map disappeared from state, clearing local cache."
          );
          this.players.forEach((_, playerId) =>
            this.notifyPlayerRemoved(playerId)
          );
          this.players.clear();
        }
      }

      // --- Planet Sync (Full State Check) ---
      if (state.planets) {
        // Use state.planets.forEach directly
        const incomingPlanetIds = new Set<string>();
        state.planets.forEach((planetData: PlanetData, planetId: string) => {
          incomingPlanetIds.add(planetId);
        });

        const localPlanetIds = new Set(this.planets.keys());

        // Removed planets
        localPlanetIds.forEach((planetId) => {
          if (!incomingPlanetIds.has(planetId)) {
            Logger.debug(
              LOGGER_SOURCE,
              `Planet removed (full sync): ${planetId}` // Restore to debug
            ); // Use constant
            this.planets.delete(planetId);
            this.notifyPlanetRemoved(planetId);
          }
        });

        // Added/updated planets
        state.planets.forEach((planetData: PlanetData, planetId: string) => {
          // Basic check if planetData seems valid before processing
          if (
            typeof planetData?.x !== "number" ||
            typeof planetData?.y !== "number" ||
            typeof planetData?.seed !== "string" ||
            typeof planetData?.radius !== "number"
          ) {
            console.warn(`Skipping invalid planet data for ID: ${planetId}`);
            return;
          }

          const clonedData = { ...planetData } as PlanetData;
          if (!localPlanetIds.has(planetId)) {
            Logger.debug(
              LOGGER_SOURCE,
              `Planet added (full sync): ${planetId}` // Restore to debug
            ); // Use constant
            this.planets.set(planetId, clonedData);
            this.notifyPlanetAdded(planetId, clonedData);
          } else {
            const localPlanet = this.planets.get(planetId);
            // Basic check for update - planets likely static, but check anyway
            if (JSON.stringify(localPlanet) !== JSON.stringify(clonedData)) {
              Logger.debug(
                LOGGER_SOURCE,
                `Planet updated (full sync): ${planetId}` // Restore to debug
              ); // Use constant
              this.planets.set(planetId, clonedData);
              this.notifyPlanetUpdated(planetId, clonedData);
            }
          }
        });
      } else {
        // Handle case where planets map disappears
        if (this.planets.size > 0) {
          Logger.warn(
            // Use constant
            LOGGER_SOURCE,
            "Planets map disappeared from state, clearing local cache."
          );
          this.planets.forEach((_, planetId) =>
            this.notifyPlanetRemoved(planetId)
          );
          this.planets.clear();
        }
      }
    });

    // Listener for room errors
    this.room.onError((code: number, message?: string) => {
      console.error(
        // Kept console.error
        `MultiplayerService: Room error (Code ${code}): ${
          message || "No message"
        }`
      );
      this.setConnectionStatus("error");
    });

    // Listener for when the client leaves the room
    this.room.onLeave((code: number) => {
      Logger.info(LOGGER_SOURCE, `Left room (Code ${code})`); // Use constant
      if (this.connectionStatus !== "disconnected") {
        this.setConnectionStatus("disconnected");
      }
      this.room = null;
      this.players.clear();
      this.planets.clear();
    });

    // Listener for physics updates from the server
    this.room.onMessage(
      "physics_update",
      (updateData: { [sessionId: string]: Partial<PlayerState> }) => {
        this.updateMpsCounter(); // Track message receipt
        this.notifyPhysicsUpdateListeners(updateData);
      }
    );

    // World Creation Time Listener
    this.room.onMessage("worldCreationTime", (timestamp: number) => {
      this.updateMpsCounter(); // Track message receipt
      if (typeof timestamp === "number") {
        Logger.setWorldCreationTime(timestamp);
        Logger.info(
          LOGGER_SOURCE,
          `World creation time received: ${timestamp}`
        );
      } else {
        Logger.warn(
          LOGGER_SOURCE,
          `Invalid worldCreationTime type: ${typeof timestamp}`
        );
      }
    });

    // Custom Messages (example)
    this.room.onMessage("server_announcement", (message) => {
      Logger.info(LOGGER_SOURCE, `Server Announcement: ${message}`);
    });

    // --- ADDED: Pong listener ---
    this.room.onMessage("pong", (message: { timestamp: number }) => {
      this.handlePong(message);
    });
    // --- END Pong listener ---
  }
}

// Export a singleton instance of the service
export const multiplayerService = new MultiplayerService();
