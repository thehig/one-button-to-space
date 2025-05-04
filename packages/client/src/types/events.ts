/**
 * Defines the structure for an entry in the game event log.
 */
export interface EventLogEntry {
  timestamp: string; // ISO 8601 format timestamp
  source: string; // Origin of the event (e.g., 'Game', 'Network', 'UI', 'Scene:MainScene')
  eventName: string; // Name of the event emitted
  data?: unknown; // Optional payload associated with the event
}
