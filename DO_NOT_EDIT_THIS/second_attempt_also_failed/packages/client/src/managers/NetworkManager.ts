/* eslint-disable @typescript-eslint/no-explicit-any */
import { Client, Room, RoomAvailable } from "colyseus.js";
import { BaseManager } from "./BaseManager";
// --- Type Imports ---
import { Logger, PhysicsStateUpdate } from "@one-button-to-space/shared";
import { RoomState as GameState } from "../schema/State"; // Import local GameState alias
import { gameEmitter } from "../main"; // Ensure gameEmitter is imported
import { EngineManager } from "./EngineManager"; // Added EngineManager import

// --- Manager Imports ---
// Removed EntityManager import, will access via EngineManager
// import { SceneManager } from "./SceneManager"; // SceneManager also seems unused directly

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
  // Removed Singleton pattern
  // protected static _instance: NetworkManager | null = null;
  private client: Client;
  private room: Room<GameState> | null = null; // Strongly typed room state
  private connectionOptions: ConnectionOptions | null = null;
  private availableRooms: RoomAvailable<GameState>[] = [];
  private pingInterval: NodeJS.Timeout | null = null;
  private pingStartTime: number = 0;
  private pingValue: number = 0; // Renamed lastPingTime to pingValue for clarity
  private messageStats = {
    incoming: 0,
    outgoing: 0,
    lastResetTime: Date.now(),
  };
  private statsUpdateInterval: NodeJS.Timeout | null = null;
  private engineManager: EngineManager; // Added EngineManager instance variable

  // Modified constructor to accept EngineManager
  constructor(engineManager: EngineManager) {
    super();
    this.engineManager = engineManager; // Store EngineManager

    // Setup logic moved to setup() method
  }

  // Removed Singleton getInstance
  // public static getInstance(): NetworkManager { ... }

  // Removed Singleton resetInstance
  // public static async resetInstance(): Promise<void> { ... }

  // --- Lifecycle Methods (Adapted from constructor and destroy) ---

  public async setup(): Promise<void> {
    Logger.info(LOGGER_SOURCE, "Setting up NetworkManager...");
    // Determine server endpoint
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
    // Initial stats update start moved here from constructor
    // Note: Consider if stats should only start *after* connection
    // this.startStatsUpdates();
    Logger.info(LOGGER_SOURCE, "NetworkManager setup complete.");
  }

  public async teardown(): Promise<void> {
    // Adapted from destroy
    Logger.info(LOGGER_SOURCE, "Tearing down NetworkManager...");
    this.stopStatsUpdates(); // Stop emitting stats and ping
    if (this.room) {
      await this.disconnect(); // Ensure disconnect is called
    }
    // No need to explicitly nullify instance variables if the manager instance itself is discarded
    Logger.info(LOGGER_SOURCE, "NetworkManager teardown complete.");
  }

  // --- Connection Management ---

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
      this.startStatsUpdates(); // Start stats *after* successful connection
      gameEmitter.emit("roomReady", this.room); // Emit room ready event
      return this.room;
    } catch (e: any) {
      Logger.error(LOGGER_SOURCE, "Failed to join room:", e);
      this.room = null;
      this.connectionOptions = null;
      this.stopStatsUpdates(); // Stop stats if connection failed
      gameEmitter.emit("roomLeave"); // Emit leave event on connection failure
      throw e; // Re-throw
    }
  }

  public async disconnect(): Promise<void> {
    this.stopStatsUpdates(); // Stop emitting stats
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

  // --- Room Listeners ---

  private setupRoomListeners(): void {
    // Added more logging inside this method
    if (!this.room) return;

    Logger.debug(LOGGER_SOURCE, "Setting up room listeners..."); // Added log

    // --- State Synchronization ---
    this.room.onStateChange.once((initialState: GameState) => {
      Logger.debug(LOGGER_SOURCE, "Initial state received.", initialState);
      this.messageStats.incoming++; // Count initial state as one message
      // Access EntityManager via EngineManager
      this.engineManager.getEntityManager().syncInitialState(initialState);
    });

    this.room.onStateChange((state: GameState) => {
      this.messageStats.incoming++; // Count incremental state change
      Logger.trace(LOGGER_SOURCE, "Incremental state received.", state); // Too noisy
      // Access EntityManager via EngineManager
      this.engineManager.getEntityManager().updateFromState(state);
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
              // Access EntityManager via EngineManager
              this.engineManager.getEntityManager().updateEntityPhysics(
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
          // TODO: Route to UI Manager via EngineManager
          this.engineManager.getUIManager().handleChatMessage(message); // Example call
          Logger.info(
            LOGGER_SOURCE,
            "Chat message received (routed to UIManager):",
            message
          );
          break;
        case "serverNotification":
          // TODO: Route to UI Manager via EngineManager
          this.engineManager.getUIManager().handleServerNotification(message); // Example call
          Logger.info(
            LOGGER_SOURCE,
            "Server notification received (routed to UIManager):",
            message
          );
          break;
        // --- Game-Specific Messages ---
        case "player_joined":
          // TODO: Add entity via EntityManager
          Logger.info(
            LOGGER_SOURCE,
            "Player joined event received (not fully handled):",
            message
          );
          break;
        case "player_left":
          // TODO: Remove entity via EntityManager
          Logger.info(
            LOGGER_SOURCE,
            "Player left event received (not fully handled):",
            message
          );
          break;

        default:
          Logger.warn(
            LOGGER_SOURCE,
            `Unhandled message type received: "${type}"`,
            message
          );
          break;
      }
    });

    // --- Room Events ---
    this.room.onError((code, message) => {
      Logger.error(LOGGER_SOURCE, `Room error (Code: ${code}):`, message);
      // Optionally trigger disconnect or UI update
      gameEmitter.emit("networkError", { code, message });
    });

    this.room.onLeave(async (code) => {
      Logger.info(LOGGER_SOURCE, `Left room (Code: ${code})`);
      this.room = null; // Clear room reference
      this.connectionOptions = null;
      this.stopStatsUpdates(); // Stop stats updates on leave
      gameEmitter.emit("roomLeave", code); // Emit leave event with code
      // Handle different leave codes if necessary (e.g., 1000 = normal closure)
      if (code !== 1000) {
        Logger.warn(LOGGER_SOURCE, `Unexpected room leave code: ${code}`);
        // Attempt reconnect? Show error?
        // await this.reconnect(); // Example: Simple reconnect attempt
      }
    });
  }

  // --- Sending Messages ---

  public sendMessage(type: string | number, payload?: any): void {
    if (this.room && this.isConnected()) {
      try {
        this.room.send(type, payload);
        this.messageStats.outgoing++; // Count outgoing messages
        Logger.trace(LOGGER_SOURCE, `Sent message type "${type}"`, payload); // Can be noisy
      } catch (e: any) {
        Logger.error(LOGGER_SOURCE, `Failed to send message "${type}":`, e);
      }
    } else {
      Logger.warn(
        LOGGER_SOURCE,
        `Cannot send message "${type}", not connected.`
      );
    }
  }

  // --- Network Stats ---

  private sendPing(): void {
    if (this.room && this.isConnected() && this.pingStartTime === 0) {
      this.pingStartTime = Date.now();
      this.sendMessage("ping", this.pingStartTime); // Send current time as payload
      Logger.trace(LOGGER_SOURCE, "Sent ping message"); // Added log
    }
  }

  private updateAndEmitStats(): void {
    if (!this.room) return;

    const now = Date.now();
    const elapsedSeconds = (now - this.messageStats.lastResetTime) / 1000;

    if (elapsedSeconds >= 1) {
      const msgInPerSec = this.messageStats.incoming / elapsedSeconds;
      const msgOutPerSec = this.messageStats.outgoing / elapsedSeconds;

      const stats: NetworkStats = {
        ping: this.pingValue, // Use the measured ping value
        msgInPerSec: parseFloat(msgInPerSec.toFixed(1)), // Format to 1 decimal place
        msgOutPerSec: parseFloat(msgOutPerSec.toFixed(1)),
      };

      gameEmitter.emit("networkStats", stats); // Emit stats update

      // Reset counters and timer
      this.messageStats.incoming = 0;
      this.messageStats.outgoing = 0;
      this.messageStats.lastResetTime = now;
    }
  }

  private startStatsUpdates(): void {
    if (this.statsUpdateInterval) return; // Already running
    Logger.debug(LOGGER_SOURCE, "Starting network stats updates...");

    // Reset stats immediately before starting interval
    this.messageStats = { incoming: 0, outgoing: 0, lastResetTime: Date.now() };
    this.pingValue = 0; // Reset ping

    this.statsUpdateInterval = setInterval(() => {
      this.sendPing(); // Send ping periodically
      this.updateAndEmitStats(); // Update and emit stats
    }, 1000); // Update every second
  }

  private stopStatsUpdates(): void {
    if (this.statsUpdateInterval) {
      clearInterval(this.statsUpdateInterval);
      this.statsUpdateInterval = null;
      Logger.debug(LOGGER_SOURCE, "Stopped network stats updates.");
    }
    if (this.pingInterval) {
      // Also clear the old ping interval if it exists
      clearInterval(this.pingInterval);
      this.pingInterval = null;
      Logger.debug(LOGGER_SOURCE, "Stopped ping interval.");
    }
  }

  // --- Status & Accessors ---

  public isConnected(): boolean {
    return !!this.room && !!this.room.connection && this.room.connection.isOpen;
  }

  public get currentRoom(): Room<GameState> | null {
    return this.room;
  }

  public get sessionId(): string | undefined {
    return this.room?.sessionId;
  }

  // Removed BaseManager overrides for init/destroy as they are now setup/teardown
  // public override init(): void { ... }
  // public override async destroy(): Promise<void> { ... }
}

// Removed Singleton export
// export default NetworkManager.getInstance();
