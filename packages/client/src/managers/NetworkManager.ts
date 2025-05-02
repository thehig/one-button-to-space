/* eslint-disable @typescript-eslint/no-explicit-any */
import { Client, Room, RoomAvailable } from "colyseus.js";
import { BaseManager } from "./BaseManager";
// --- Type Imports ---
import { Logger, PhysicsStateUpdate } from "@one-button-to-space/shared";
import { RoomState as GameState } from "../schema/State"; // Import local GameState alias
import { gameEmitter } from "../main"; // Ensure gameEmitter is imported

// --- Manager Imports ---
import { EntityManager } from "./EntityManager";
import { SceneManager } from "./SceneManager";
import { GameManagerRegistry } from "./GameManagerRegistry"; // Import registry

// Logger Source for this file
const LOGGER_SOURCE = "🌐";

// Define the structure of expected room options
interface ConnectionOptions {
  playerName: string;
  // Add other options like authentication tokens, session IDs, etc.
}

// Define the structure for network stats
export interface NetworkStats {
  // Ensure interface is defined/exported
  ping: number;
  msgInPerSec: number;
  msgOutPerSec: number;
}

export class NetworkManager extends BaseManager {
  protected static _instance: NetworkManager | null = null;
  private client: Client;
  private room: Room<GameState> | null = null; // Strongly typed room state
  private connectionOptions: ConnectionOptions | null = null;
  private availableRooms: RoomAvailable<GameState>[] = [];
  private pingInterval: NodeJS.Timeout | null = null;
  private pingStartTime: number = 0;
  private lastPingTime: number = 0; // Store the last measured ping
  private messageStats = {
    incoming: 0,
    outgoing: 0,
    lastResetTime: Date.now(),
  };
  private statsUpdateInterval: NodeJS.Timeout | null = null;

  private constructor() {
    super();
    // Determine server endpoint
    // 1. Prioritize VITE_SERVER_URL environment variable
    // 2. Fallback to localhost for development
    // 3. Fallback to placeholder for production
    const envServerUrl = import.meta.env.VITE_SERVER_URL;
    let endpoint: string;

    if (envServerUrl) {
      endpoint = envServerUrl;
      Logger.info(
        LOGGER_SOURCE,
        `Using server URL from environment: ${endpoint}`
      );
    } else if (import.meta.env.DEV) {
      endpoint = "ws://localhost:2567"; // Local development server
      Logger.info(
        LOGGER_SOURCE,
        `Using default development server URL: ${endpoint}`
      );
    } else {
      // IMPORTANT: Replace with your actual production WebSocket endpoint placeholder
      // or ensure VITE_SERVER_URL is set in the production build environment
      endpoint = "wss://your-production-server.com"; // Default production placeholder
      Logger.warn(
        LOGGER_SOURCE,
        `VITE_SERVER_URL not set, using default production placeholder: ${endpoint}`
      );
    }

    this.client = new Client(endpoint);
    this.startStatsUpdater();
  }

  public static getInstance(): NetworkManager {
    if (!NetworkManager._instance) {
      NetworkManager._instance = new NetworkManager();
      GameManagerRegistry.getInstance().registerManager(
        NetworkManager._instance
      );
    }
    return NetworkManager._instance;
  }

  public static async resetInstance(): Promise<void> {
    if (NetworkManager._instance) {
      Logger.debug(LOGGER_SOURCE, "Resetting NetworkManager instance...");
      await NetworkManager._instance.cleanup(false);
      NetworkManager._instance = null;
      Logger.debug(LOGGER_SOURCE, "NetworkManager instance reset complete.");
    } else {
      Logger.trace(
        LOGGER_SOURCE,
        "NetworkManager instance already null, skipping reset."
      );
    }
  }

  public async connect(
    roomName: string,
    options: ConnectionOptions
  ): Promise<Room<GameState>> {
    if (this.room) {
      Logger.warn(LOGGER_SOURCE, "Already connected. Disconnecting first.");
      await this.disconnect();
    }

    try {
      Logger.info(
        LOGGER_SOURCE,
        `Attempting to join/create room: ${roomName}`,
        options
      );
      this.connectionOptions = options;
      this.room = await this.client.joinOrCreate<GameState>(roomName, options);
      Logger.info(
        LOGGER_SOURCE,
        `Joined room: ${this.room.roomId}, Session ID: ${this.room.sessionId}`
      );
      Logger.trace(LOGGER_SOURCE, "Room joined successfully", this.room);
      this.setupRoomListeners();
      this.startStatsUpdater(); // Start emitting stats
      gameEmitter.emit("roomReady", this.room); // Emit room ready event
      return this.room;
    } catch (e: any) {
      Logger.error(LOGGER_SOURCE, "Failed to join room:", e);
      this.room = null;
      this.connectionOptions = null;
      gameEmitter.emit("roomLeave"); // Emit leave event on connection failure
      throw e; // Re-throw
    }
  }

  public async disconnect(): Promise<void> {
    this.stopStatsUpdater(); // Stop emitting stats
    if (this.room) {
      const roomId = this.room.roomId;
      try {
        Logger.info(LOGGER_SOURCE, `Leaving room: ${roomId}`);
        // Pass false to leave immediately without waiting for graceful close
        await this.room.leave(false);
        Logger.info(LOGGER_SOURCE, `Left room: ${roomId}`);
      } catch (e: any) {
        Logger.error(LOGGER_SOURCE, `Error leaving room ${roomId}:`, e);
      } finally {
        this.room = null;
        this.connectionOptions = null;
        gameEmitter.emit("roomLeave"); // Emit leave event after disconnecting
      }
    } else {
      Logger.info(LOGGER_SOURCE, "Not connected, cannot disconnect.");
    }
  }

  private setupRoomListeners(): void {
    // Added more logging inside this method
    if (!this.room) return;

    Logger.debug(LOGGER_SOURCE, "Setting up room listeners..."); // Added log

    // --- State Synchronization ---
    this.room.onStateChange.once((initialState: GameState) => {
      Logger.debug(LOGGER_SOURCE, "Initial state received.", initialState);
      this.messageStats.incoming++; // Count initial state as one message
      EntityManager.getInstance().syncInitialState(initialState);
    });

    this.room.onStateChange((state: GameState) => {
      this.messageStats.incoming++; // Count incremental state change
      Logger.trace(LOGGER_SOURCE, "Incremental state received.", state); // Too noisy
      EntityManager.getInstance().updateFromState(state);
    });

    // --- Custom Messages ---
    this.room.onMessage("*", (type, message) => {
      this.messageStats.incoming++; // Count every message
      // Logger.trace(LOGGER_SOURCE, `Received message type "${type}"`, message); // Can be noisy
      switch (type) {
        case "pong": // Handle pong for ping measurement
          Logger.trace(LOGGER_SOURCE, "Received pong message", message); // Added log
          if (typeof message === "number" && this.pingStartTime > 0) {
            this.pingValue = Date.now() - message; // Use the timestamp sent back by server
            this.pingStartTime = 0; // Reset ping start time
            Logger.trace(LOGGER_SOURCE, `Ping measured: ${this.pingValue}ms`);
          } else {
            Logger.warn(
              LOGGER_SOURCE,
              "Received invalid pong message or ping not initiated:",
              message
            );
          }
          break;

        case "worldCreationTime":
          if (typeof message === "number") {
            Logger.setWorldCreationTime(message);
            // Log at info level as this happens once
            Logger.info(
              LOGGER_SOURCE,
              `World creation time synced: ${message}`
            );
          } else {
            Logger.warn(
              LOGGER_SOURCE,
              "Received invalid worldCreationTime message:",
              message
            );
          }
          break;

        case "physics_update":
          // Assuming message is an object like { entityId: physicsData, ... }
          // And physicsData matches PhysicsStateUpdate type
          if (typeof message === "object" && message !== null) {
            // Log at trace level as this happens frequently
            Logger.trace(
              LOGGER_SOURCE,
              "Processing physics update batch...",
              Object.keys(message)
            );
            Object.entries(message).forEach(([entityId, physicsData]) => {
              EntityManager.getInstance().updateEntityPhysics(
                entityId,
                physicsData as PhysicsStateUpdate // Cast to expected type
              );
            });
          } else {
            Logger.warn(
              LOGGER_SOURCE,
              "Received invalid physics_update message:",
              message
            );
          }
          break;

        case "chat":
          // TODO: Route to UI Manager
          Logger.info(
            LOGGER_SOURCE,
            "Chat message received (not handled):",
            message
          );
          break;
        case "serverNotification":
          // TODO: Route to UI Manager
          Logger.info(
            LOGGER_SOURCE,
            "Server notification received (not handled):",
            message
          );
          break;
        default:
          Logger.warn(
            LOGGER_SOURCE,
            `Unhandled message type "${type}"`,
            message
          );
      }
    });

    // --- Room Lifecycle Events ---
    this.room.onError((code, message) => {
      Logger.error(LOGGER_SOURCE, `Room error (code: ${code}): ${message}`);
      this.disconnect(); // Attempt cleanup
      SceneManager.getInstance().startScene("MainMenuScene", {
        error: `Connection error: ${message || "Unknown room error"}`,
      });
    });

    this.room.onLeave((code) => {
      Logger.info(
        LOGGER_SOURCE,
        `Left room via onLeave callback (code: ${code})`
      );
      this.room = null; // Ensure room reference is cleared
      this.connectionOptions = null;
      this.stopStatsUpdates();
      gameEmitter.emit("roomLeave"); // Emit leave event
      // TODO: Potentially trigger UI update or scene change
    });
    Logger.debug(LOGGER_SOURCE, "Finished setting up room listeners."); // Added log
  }

  /**
   * Send a message (input or action) to the server room.
   * @param type Message type identifier (string or number).
   * @param payload Optional data payload for the message.
   */
  public sendMessage(type: string | number, payload?: any): void {
    if (this.isConnected()) {
      this.outgoingMessages++; // Count outgoing message
      this.room!.send(type, payload);
      // Logger.trace(LOGGER_SOURCE, `Sent message type "${type}"`, payload); // Can be noisy
    } else {
      Logger.warn(LOGGER_SOURCE, "Cannot send message, not connected.");
    }
  }

  // --- Stats Methods ---

  private sendPing(): void {
    if (this.isConnected() && this.pingStartTime === 0) {
      this.pingStartTime = Date.now();
      this.sendMessage("ping", this.pingStartTime); // Send current time
      Logger.trace(LOGGER_SOURCE, "Sent ping"); // Changed log level
    }
  }

  private updateAndEmitStats(): void {
    Logger.trace(LOGGER_SOURCE, "updateAndEmitStats called"); // Added log
    const now = Date.now();
    const deltaTime = (now - this.lastStatsUpdateTime) / 1000; // Delta in seconds

    if (deltaTime > 0) {
      const msgInPerSec = this.incomingMessages / deltaTime;
      const msgOutPerSec = this.outgoingMessages / deltaTime;

      const stats: NetworkStats = {
        ping: this.pingValue,
        msgInPerSec: msgInPerSec,
        msgOutPerSec: msgOutPerSec,
      };

      Logger.trace(LOGGER_SOURCE, "Emitting networkStatsUpdate", stats); // Added log
      gameEmitter.emit("networkStatsUpdate", stats);
      // Logger.trace(LOGGER_SOURCE, "Network stats emitted", stats); // Can be noisy

      // Reset counters for the next interval
      this.incomingMessages = 0;
      this.outgoingMessages = 0;
      this.lastStatsUpdateTime = now;

      // Initiate next ping measurement
      this.sendPing();
    }
  }

  private startStatsUpdates(): void {
    this.stopStatsUpdates(); // Clear any existing interval
    Logger.info(
      LOGGER_SOURCE,
      `Starting network stats updates every ${this.STATS_UPDATE_INTERVAL}ms`
    ); // Keep info level
    this.lastStatsUpdateTime = Date.now();
    this.incomingMessages = 0;
    this.outgoingMessages = 0;
    this.pingValue = -1;
    this.statsInterval = setInterval(
      () => this.updateAndEmitStats(),
      this.STATS_UPDATE_INTERVAL
    );
    this.sendPing(); // Initial ping
  }

  private stopStatsUpdates(): void {
    if (this.statsInterval) {
      Logger.info(LOGGER_SOURCE, "Stopping network stats updates");
      clearInterval(this.statsInterval);
      this.statsInterval = null;
      this.pingValue = -1; // Reset ping on disconnect
      this.pingStartTime = 0;
    }
  }

  // --- Getters ---

  public isConnected(): boolean {
    // Check if room exists and the underlying connection is open
    return !!this.room && this.room.connection.isOpen;
  }

  public get currentRoom(): Room<GameState> | null {
    return this.room;
  }

  public get sessionId(): string | undefined {
    return this.room?.sessionId;
  }

  // --- Lifecycle Methods ---

  public override init(): void {
    Logger.debug(LOGGER_SOURCE, "Network Manager Initialized");
    // Any initialization for NetworkManager itself
  }

  /**
   * Cleans up NetworkManager resources.
   * Handles disconnecting from the room unless it's an HMR dispose.
   * @param isHMRDispose - True if called during HMR dispose.
   */
  public override async cleanup(isHMRDispose: boolean): Promise<void> {
    Logger.info(
      LOGGER_SOURCE,
      `Network Manager cleanup called (HMR: ${isHMRDispose}).`
    );
    this.stopStatsUpdates(); // Ensure stats updates stop

    if (!isHMRDispose && this.room) {
      // Only disconnect if it's NOT HMR dispose AND we have a room
      // HMR dispose is handled externally in main.tsx before cleanupApp
      const roomId = this.room.roomId;
      try {
        Logger.info(LOGGER_SOURCE, `Cleanup: Leaving room: ${roomId}`);
        await this.room.leave(false);
        Logger.info(LOGGER_SOURCE, `Cleanup: Left room: ${roomId}`);
      } catch (e: any) {
        Logger.error(
          LOGGER_SOURCE,
          `Cleanup: Error leaving room ${roomId}:`,
          e
        );
      }
    } else if (isHMRDispose) {
      Logger.debug(
        LOGGER_SOURCE,
        "Cleanup: Skipping room.leave() during HMR dispose."
      );
    } else {
      Logger.debug(LOGGER_SOURCE, "Cleanup: No room connection to leave.");
    }

    // Always clear local state regardless of HMR
    this.room = null;
    this.connectionOptions = null;
    // Don't emit roomLeave here if it's HMR, main.tsx handles that context
    if (!isHMRDispose) {
      gameEmitter.emit("roomLeave"); // Emit leave event only on full cleanup
    }

    Logger.debug(LOGGER_SOURCE, "Network Manager cleanup complete.");
  }

  /**
   * Destroys the NetworkManager.
   */
  public override async destroy(): Promise<void> {
    Logger.info(LOGGER_SOURCE, "Network Manager Destroyed");
    await this.cleanup(false); // Perform full cleanup
    // Any other final destruction tasks for the manager itself
    // For instance, remove any global listeners setup by the Client if needed
  }
}
