/**
 * Shared event names for client-side or server-side event bus communication.
 */
export const EventNames = {
  // Input Events (from InputManager)
  INPUT_ACTION_START: "input:action:start",
  INPUT_ACTION_END: "input:action:end",
  INPUT_THRUST_CHANGED: "input:thrust:changed", // value: 0 to 1
  INPUT_ORIENTATION_CHANGED: "input:orientation:changed", // value: e.g., angle or delta

  // Game State Events
  GAME_STATE_CHANGED: "game:state:changed",
  PLAYER_SCORE_UPDATED: "player:score:updated",
  MISSION_STARTED: "mission:started",
  MISSION_COMPLETED: "mission:completed",
  MISSION_FAILED: "mission:failed",

  // Entity Events
  ENTITY_CREATED: "entity:created",
  ENTITY_DESTROYED: "entity:destroyed",
  ROCKET_LAUNCHED: "rocket:launched",
  ROCKET_LANDED: "rocket:landed",
  ROCKET_CRASHED: "rocket:crashed",
  DEBRIS_SPAWNED: "debris:spawned",

  // UI Events (potentially from React to Phaser or vice-versa if needed)
  UI_BUTTON_CLICK: "ui:button:click",
  UI_SHOW_SCREEN: "ui:show:screen",
  UI_HIDE_SCREEN: "ui:hide:screen",

  // Network Events (client-side notifications)
  NETWORK_CONNECTED: "network:connected",
  NETWORK_DISCONNECTED: "network:disconnected",
  NETWORK_ERROR: "network:error",
  NETWORK_ROOM_JOINED: "network:room:joined",
  NETWORK_ROOM_LEFT: "network:room:left",
  NETWORK_PLAYER_JOINED: "network:player:joined",
  NETWORK_PLAYER_LEFT: "network:player:left",
  NETWORK_STATE_SYNC: "network:state:sync", // General state sync event

  // Add more as needed...
} as const;

// If you want to ensure type safety for event listeners and emitters,
// you can create a type that maps event names to their payload types.
// Example:
/*
export interface EventPayloads {
  [EventNames.INPUT_THRUST_CHANGED]: { value: number };
  [EventNames.PLAYER_SCORE_UPDATED]: { playerId: string, newScore: number };
  // ... other event payloads
}
*/
