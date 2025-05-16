/**
 * Defines more abstract input actions, moving beyond simple direction booleans.
 */
export enum InputAction {
  THRUST_START = "THRUST_START",
  THRUST_END = "THRUST_END",
  ROTATE_LEFT_START = "ROTATE_LEFT_START",
  ROTATE_LEFT_END = "ROTATE_LEFT_END",
  ROTATE_RIGHT_START = "ROTATE_RIGHT_START",
  ROTATE_RIGHT_END = "ROTATE_RIGHT_END",
  // For continuous values like tilt or analog stick for orientation
  SET_ORIENTATION_TARGET = "SET_ORIENTATION_TARGET", // Payload: { angle: number } or { x: number, y: number } for vector
  // For single button variable thrust if applicable
  SET_THRUST_LEVEL = "SET_THRUST_LEVEL", // Payload: { level: number } (0 to 1)
}

/**
 * Represents a single input event with an action and optional payload.
 */
export interface IInputActionPayload {
  action: InputAction;
  tick: number; // Correlate with server tick for processing
  value?: any; // Optional payload, e.g., { angle: number } for SET_ORIENTATION_TARGET
}

/**
 * This is the existing simple input structure used by the current examples.
 * It might be kept for basic movement or eventually replaced/augmented by IInputActionPayload.
 */
export interface ISimpleInputState {
  left: boolean;
  right: boolean;
  up: boolean; // Main thrust in current examples
  down: boolean; // Could be retro, brake, or unused
  tick?: number;
}

// It's also useful to have a type for the data that might be sent over the network
// This could be a list of IInputActionPayload events, or the ISimpleInputState.
// For now, aligning with current server schema InputData.ts (which matches ISimpleInputState)
export type NetworkInputPayload = ISimpleInputState;

// Example of a more complex payload if sending a list of actions:
// export type NetworkInputPayload = IInputActionPayload[];
