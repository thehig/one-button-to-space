/**
 * Defines the structure for an entry in the game event log.
 */
export interface EventLogEntry {
  timestamp: string; // ISO 8601 format timestamp
  source: string; // Origin of the event (e.g., 'Game', 'Network', 'UI', 'Scene:MainScene')
  eventName: string; // Name of the event emitted
  data?: unknown; // Optional payload associated with the event
}

// --- Remove PostMessage Types ---
/*
export interface LogUpdateMessage {
  type: "logUpdate";
  payload: EventLogEntry[]; // Can be full log or just new entries
}

export interface LogClearMessage {
  type: "logClear";
}

export interface LogClearRequestMessage {
  type: "clearLogRequest";
}

export interface LogInitialRequestMessage {
  type: "requestInitialLog";
}

export type LogWindowMessage = LogUpdateMessage | LogClearMessage;
export type MainWindowMessage =
  | LogClearRequestMessage
  | LogInitialRequestMessage;
*/
// --- End Remove PostMessage Types ---

export interface SourceTreeNode {
  id: string; // Unique identifier (usually the source name)
  label?: string; // Display name (now optional)
  symbol?: string; // Emoji/Symbol
  children?: SourceTreeNode[];
}
