import type { IBodyDefinition } from "matter-js";

// Base Command Structure
export interface PhysicsCommand<T = any> {
  type: string; // Should be one of CommandType
  payload: T;
  commandId?: string; // Optional: for tracking commands and their responses
}

// Specific Command Payloads
export interface InitWorldCommandPayload {
  canvas?: OffscreenCanvas;
  width: number;
  height: number;
  gravity?: { x: number; y: number; scale?: number };
  // Other world/engine settings
}

export interface AddBodyCommandPayload {
  id: string | number; // Make ID mandatory for easier tracking
  type: "rectangle" | "circle" | "polygon" | "fromVertices"; // Refined types
  x: number;
  y: number;
  width?: number; // For rectangle
  height?: number; // For rectangle
  radius?: number; // For circle
  sides?: number; // For polygon (e.g., Matter.Bodies.polygon sides count)
  slope?: number; // For polygon
  vertices?: { x: number; y: number }[]; // For fromVertices or polygon
  options?: IBodyDefinition; // Ensure this uses IBodyDefinition directly
}

export interface RemoveBodyCommandPayload {
  id: string | number; // ID of the body to remove
}

export interface StepSimulationCommandPayload {
  deltaTime: number; // Time step in milliseconds
}

// Enum for command types for better type safety and autocompletion
export enum CommandType {
  // To Worker
  INIT_WORLD = "INIT_WORLD",
  ADD_BODY = "ADD_BODY",
  REMOVE_BODY = "REMOVE_BODY",
  UPDATE_BODY = "UPDATE_BODY", // Placeholder for updating existing body properties
  APPLY_FORCE = "APPLY_FORCE", // Placeholder
  SET_GRAVITY = "SET_GRAVITY", // Placeholder
  STEP_SIMULATION = "STEP_SIMULATION",

  // From Worker (Responses/Events)
  WORKER_READY = "WORKER_READY",
  WORLD_INITIALIZED = "WORLD_INITIALIZED",
  BODY_ADDED = "BODY_ADDED",
  BODY_REMOVED = "BODY_REMOVED",
  SIMULATION_STEPPED = "SIMULATION_STEPPED",
  PHYSICS_EVENTS = "PHYSICS_EVENTS",
  ERROR = "ERROR",
}
