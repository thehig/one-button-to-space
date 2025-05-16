export enum NetworkMessageType {
  // Client to Server
  PLAYER_INPUT = "PLAYER_INPUT",
  CLIENT_READY = "CLIENT_READY", // Player client has loaded assets and is ready to join/spawn
  PLAYER_ACTION = "PLAYER_ACTION", // e.g., fire thruster, toggle landing gear (if we add more actions)

  // Server to Client
  GAME_STATE_UPDATE = "GAME_STATE_UPDATE",
  PLAYER_JOINED = "PLAYER_JOINED",
  PLAYER_LEFT = "PLAYER_LEFT",
  ENTITY_SPAWNED = "ENTITY_SPAWNED",
  ENTITY_DESTROYED = "ENTITY_DESTROYED",
  ENTITY_UPDATE = "ENTITY_UPDATE", // For individual entity updates if not part of full game state
  MISSION_UPDATE = "MISSION_UPDATE",
  SERVER_MESSAGE = "SERVER_MESSAGE", // For general messages, warnings, errors
  INITIAL_GAME_DATA = "INITIAL_GAME_DATA", // Sent when player first joins, includes map dimensions, existing entities etc.
}

export interface INetworkMessage<T = unknown> {
  type: NetworkMessageType | string; // Allow custom string types for flexibility initially
  payload: T;
  timestamp: number; // server or client originated timestamp
  sequenceNumber?: number; // Optional sequence number for C->S messages if needed for input processing
}

// Specific payload examples (can be expanded)

/**
 * Matches the existing ISimpleInputState / InputPayload for now.
 * Defined in inputs.ts, re-exported here for clarity in network context.
 */
export { type ISimpleInputState as PlayerInputPayload } from "./inputs";

export interface IGameStateUpdatePayload {
  // Example: A map of entity IDs to their state
  // This will be fleshed out more as game state schema is defined
  entities: Record<
    string,
    {
      x: number;
      y: number;
      angle?: number;
      vx?: number;
      vy?: number;
      [key: string]: any;
    }
  >;
  serverTime: number;
}

export interface IPlayerJoinedPayload {
  sessionId: string;
  playerId: string; // Could be the same as sessionId or a separate game-specific ID
  initialState: { x: number; y: number; [key: string]: any }; // Initial state of the player
}

export interface IPlayerLeftPayload {
  sessionId: string;
  playerId: string;
}

export interface IEntitySpawnedPayload {
  entityId: string;
  entityType: string; // e.g., 'ROCKET', 'DEBRIS', 'PLANET'
  initialState: { x: number; y: number; [key: string]: any };
  ownerId?: string; // SessionId of the player who owns/spawned this entity
}

export interface IEntityDestroyedPayload {
  entityId: string;
}

export interface IServerMessagePayload {
  message: string;
  level: "info" | "warning" | "error";
}

// More specific payload types can be added as needed
