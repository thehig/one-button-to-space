/* eslint-disable @typescript-eslint/no-explicit-any */
import { Client, Room } from "colyseus.js";
import { BaseManager } from "./BaseManager";
// --- Type Imports ---
import { Logger, PhysicsStateUpdate } from "@one-button-to-space/shared";
import { RoomState as GameState } from "../schema/State"; // Import local GameState alias

// --- Manager Imports ---
import { EntityManager } from "./EntityManager";
import { SceneManager } from "./SceneManager";

// Logger Source for this file
const LOGGER_SOURCE = "🌐";

// Define the structure of expected room options
interface ConnectionOptions {
  playerName: string;
  // Add other options like authentication tokens, session IDs, etc.
}

export class NetworkManager extends BaseManager {
  protected static _instance: NetworkManager | null = null;
  private client: Client;
  private room: Room<GameState> | null = null; // Strongly typed room state
  private connectionOptions: ConnectionOptions | null = null;

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
    // Logger.info removed here, logged within the if/else blocks now
  }

  public static getInstance(): NetworkManager {
    if (!NetworkManager._instance) {
      NetworkManager._instance = new NetworkManager();
    }
    return NetworkManager._instance;
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
      return this.room;
    } catch (e: any) {
      Logger.error(LOGGER_SOURCE, "Failed to join room:", e);
      this.room = null;
      this.connectionOptions = null;
      throw e; // Re-throw
    }
  }

  public async disconnect(): Promise<void> {
    if (this.room) {
      const roomId = this.room.roomId;
      try {
        Logger.info(LOGGER_SOURCE, `Leaving room: ${roomId}`);
        await this.room.leave(true);
        Logger.info(LOGGER_SOURCE, `Left room: ${roomId}`);
      } catch (e: any) {
        Logger.error(LOGGER_SOURCE, `Error leaving room ${roomId}:`, e);
      } finally {
        this.room = null;
        this.connectionOptions = null;
      }
    } else {
      Logger.info(LOGGER_SOURCE, "Not connected, cannot disconnect.");
    }
  }

  private setupRoomListeners(): void {
    if (!this.room) return;

    // --- State Synchronization ---
    this.room.onStateChange.once((initialState: GameState) => {
      Logger.debug(LOGGER_SOURCE, "Initial state received.", initialState);
      EntityManager.getInstance().syncInitialState(initialState);
    });

    this.room.onStateChange((state: GameState) => {
      Logger.trace(LOGGER_SOURCE, "Incremental state received.", state); // Too noisy
      EntityManager.getInstance().updateFromState(state);
    });

    // --- Custom Messages ---
    this.room.onMessage("*", (type, message) => {
      Logger.trace(LOGGER_SOURCE, `Received message type "${type}"`, message); // Log raw message if needed
      switch (type) {
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
      Logger.info(LOGGER_SOURCE, `Disconnected from room (code: ${code})`);
      const graceful = code === 1000;
      const wasConnected = !!this.room; // Check if we were actually connected
      this.room = null;
      this.connectionOptions = null;
      if (wasConnected) {
        SceneManager.getInstance().startScene("MainMenuScene", {
          error: graceful
            ? undefined
            : `Disconnected unexpectedly (code: ${code})`,
          message: graceful ? "Disconnected from server" : undefined,
        });
      }
    });
  }

  /**
   * Send a message (input or action) to the server room.
   * @param type Message type identifier (string or number).
   * @param payload Optional data payload for the message.
   */
  public sendMessage(type: string | number, payload?: any): void {
    if (this.isConnected()) {
      this.room!.send(type, payload);
      // Logger.trace(LOGGER_SOURCE, `Sent message type "${type}"`, payload); // Can be noisy
    } else {
      Logger.warn(LOGGER_SOURCE, "Cannot send message, not connected.");
    }
  }

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

  public override init(): void {
    // No specific init logic here, constructor handles setup
  }

  public override async destroy(): Promise<void> {
    Logger.info(LOGGER_SOURCE, "Network Manager Destroying");
    await this.disconnect(); // Ensure disconnection on destroy
    NetworkManager._instance = null;
  }
}
