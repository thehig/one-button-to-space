/* eslint-disable @typescript-eslint/no-explicit-any */
import { Client, Room } from "colyseus.js";
import { BaseManager } from "./BaseManager";
// Adjust the path based on your actual monorepo structure and where the shared types live
// Assuming a shared package or direct path for now. Need to verify this path.
import { GameState } from "../../../server/src/schema/GameState";
import { EntityManager } from "./EntityManager"; // Placeholder, ensure correct path
import { SceneManager } from "./SceneManager"; // Placeholder, ensure correct path

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
    // Determine server endpoint based on environment
    const endpoint = import.meta.env.DEV
      ? "ws://localhost:2567" // Local development server
      : // IMPORTANT: Replace with your actual production WebSocket endpoint
        "wss://your-production-server.com";
    this.client = new Client(endpoint);
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
      console.warn("Already connected to a room. Disconnecting first.");
      await this.disconnect();
    }

    try {
      console.log(`Attempting to join or create room: ${roomName}`, options);
      this.connectionOptions = options;
      // Join or create the room with the provided options
      this.room = await this.client.joinOrCreate<GameState>(roomName, options);
      console.log(
        "Successfully joined room:",
        this.room.sessionId,
        " Room ID:",
        this.room.id
      );
      this.setupRoomListeners();
      return this.room;
    } catch (e: any) {
      console.error("Failed to join room:", e);
      this.room = null;
      this.connectionOptions = null;
      // Consider more specific error handling or user feedback here
      throw e; // Re-throw the error for the caller to handle
    }
  }

  public async disconnect(): Promise<void> {
    if (this.room) {
      const roomId = this.room.id;
      try {
        console.log(`Leaving room: ${roomId}`);
        // Pass true to immediately close the connection and trigger onLeave
        await this.room.leave(true);
        console.log(`Successfully left room: ${roomId}`);
      } catch (e: any) {
        // Handle potential errors during leave (e.g., connection already closed)
        console.error(`Error leaving room ${roomId}:`, e);
      } finally {
        // Ensure room is cleared even if leave() throws an error
        this.room = null;
        this.connectionOptions = null;
      }
    } else {
      console.log("Not connected to any room.");
    }
  }

  private setupRoomListeners(): void {
    if (!this.room) return;

    // --- State Synchronization ---
    // Listen for the initial full state snapshot
    this.room.onStateChange.once((initialState: GameState) => {
      console.log("Initial state received");
      // Pass the initial state to the EntityManager for setup
      EntityManager.getInstance().syncInitialState(initialState);
    });

    // Listen for subsequent incremental state changes
    this.room.onStateChange((state: GameState) => {
      // Pass incremental changes to the EntityManager
      EntityManager.getInstance().updateFromState(state);
    });

    // --- Custom Messages ---
    // Generic message listener
    this.room.onMessage("*", (type, message) => {
      console.log(`Received message of type "${type}":`, message);
      // TODO: Route specific message types to appropriate handlers/managers
      switch (type) {
        case "chat":
          // UIManager.getInstance().displayChatMessage(message);
          break;
        case "serverNotification":
          // UIManager.getInstance().showNotification(message);
          break;
        // Add more cases for different message types
      }
    });

    // --- Room Lifecycle Events ---
    // Listen for errors from the room
    this.room.onError((code, message) => {
      console.error(`Room error (${code}): ${message}`);
      // TODO: Implement more robust error handling
      // Maybe attempt reconnection or notify the user
      // Consider disconnecting if the error is fatal
      this.disconnect(); // Attempt to clean up
      // Example: Transition to an error scene or main menu
      SceneManager.getInstance().startScene("MainMenuScene", {
        error: `Connection error: ${message}`,
      });
    });

    // Listen for when the client leaves the room (voluntarily or due to error/kick)
    this.room.onLeave((code) => {
      console.log(`Disconnected from room (code: ${code})`);
      const gracefulDisconnect = code === 1000; // 1000 = Normal Closure
      const wasConnected = this.room !== null; // Check if we were actually connected before this event

      this.room = null; // Clear the room reference
      this.connectionOptions = null;

      if (wasConnected) {
        // TODO: Handle disconnection - return to main menu, show message
        // Only transition if not already transitioning due to an error handled above
        if (gracefulDisconnect) {
          SceneManager.getInstance().startScene("MainMenuScene", {
            message: "Disconnected",
          });
        } else {
          // Maybe show a different message for unexpected disconnects
          SceneManager.getInstance().startScene("MainMenuScene", {
            error: `Disconnected unexpectedly (code: ${code})`,
          });
        }
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
    } else {
      console.warn("Cannot send message, not connected to a room.");
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
    console.log("Network Manager Initialized");
    // Initialization logic for the manager itself, if any
  }

  public override async destroy(): Promise<void> {
    console.log("Network Manager Destroying");
    await this.disconnect(); // Ensure disconnection on destroy
    NetworkManager._instance = null;
  }
}
