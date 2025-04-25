/**
 * Defines the structure for player input messages sent from client to server.
 */
export type PlayerInputMessage = {
  /** Sequence number assigned by the client for ordering and reconciliation. */
  seq: number;
  /** The type of input being sent. */
  input: "thrust_start" | "thrust_stop" | "set_angle";
  /** Optional value associated with the input (e.g., target angle in radians). */
  value?: number;
  /** Optional client timestamp when the input occurred (milliseconds). */
  timestamp?: number;
};

// Add other shared input-related types or enums here if needed
