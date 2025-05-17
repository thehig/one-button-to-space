import Matter from "matter-js";
import { ICelestialBody, ICustomBodyPlugin } from "../PhysicsEngine";

export type ScenarioBodyType = "box" | "circle" | "rocket";

export interface ScenarioBodyInitialState {
  id: string; // Unique ID for this body within the scenario
  type: ScenarioBodyType;
  label?: string; // Corresponds to Matter.Body.label
  initialPosition: Matter.Vector;
  initialVelocity?: Matter.Vector;
  initialAngle?: number;
  initialAngularVelocity?: number;
  // Specific dimensions, required depending on type
  width?: number; // For box
  height?: number; // For box
  radius?: number; // For circle
  // General Matter.js body options, including plugin data
  options?: Partial<Matter.IBodyDefinition & { plugin: ICustomBodyPlugin }>;
  mass?: number; // Optional: if not provided, Matter.js calculates it
}

export type ScenarioActionType = "applyForce" | "setVelocity" | "custom";

export interface ScenarioAction {
  step: number; // The simulation step number at which this action occurs (e.g., 0 for before the first step)
  targetBodyId: string; // ID of the body this action applies to
  actionType: ScenarioActionType;
  // Parameters for specific actions - extend with a union type if more actions are added
  force?: Matter.Vector; // For applyForce
  velocity?: Matter.Vector; // For setVelocity
  applicationPoint?: Matter.Vector; // For applyForce (world coordinates)
  customActionData?: any; // For custom actions
}

export interface ScenarioEngineSettings {
  fixedTimeStepMs?: number;
  customG?: number;
  enableInternalLogging?: boolean;
}

export interface IScenario {
  id: string; // Unique identifier for the scenario
  name: string; // Display name for the scenario
  description?: string;
  engineSettings?: ScenarioEngineSettings;
  celestialBodies?: ICelestialBodyData[];
  initialBodies: ScenarioBodyInitialState[];
  actions?: ScenarioAction[];
  simulationSteps: number; // Total number of fixed steps to run for the main simulation phase
  // Expected outcomes could be defined here for programmatic validation,
  // or handled by the test runner consuming the scenario.
  // For now, assertions will remain in the .spec.ts files.
}

// Add re-exports
export type { ICelestialBody, ICustomBodyPlugin };

// Data interface for celestial bodies to avoid direct Matter.Vector in JSON structure
export interface ICelestialBodyData {
  id: string;
  mass: number;
  position: { x: number; y: number };
  gravityRadius: number;
  radius?: number;
  hasAtmosphere?: boolean;
  atmosphereLimitAltitude?: number;
  surfaceAirDensity?: number;
  scaleHeight?: number;
}

// --- New interfaces for PhysicsEngine serialization ---

export interface ISerializedVector {
  x: number;
  y: number;
}

export interface ISerializedBodyRenderOptions {
  visible?: boolean;
  opacity?: number;
  fillStyle?: string;
  strokeStyle?: string;
  lineWidth?: number;
  // Add other relevant render options, e.g., sprite texture, xScale, yScale
  sprite?: {
    texture?: string | null;
    xScale?: number | null;
    yScale?: number | null;
    xOffset?: number | null;
    yOffset?: number | null;
  };
}

export interface ISerializedCustomBodyPlugin {
  dragCoefficientArea?: number | null;
  effectiveNoseRadius?: number | null;
  currentHeatFlux?: number | null;
  creationParams?: // Added for body reconstruction
  | { type: "box"; width: number; height: number }
    | { type: "circle"; radius: number }
    | { type: "rocket" }
    | { type: "polygon"; vertices: { x: number; y: number }[] }; // Use plain objects for vertices
}

export interface ISerializedMatterBody {
  // Core Matter.js properties
  id: number; // Matter's internal ID
  label: string; // Our custom ID
  type: string; // 'body', 'composite', etc.
  parts: number[]; // IDs of part bodies if composite, or empty array
  position: ISerializedVector;
  angle: number | null;
  velocity: ISerializedVector;
  angularVelocity: number | null;
  mass: number;
  inverseMass: number;
  inertia: number;
  inverseInertia: number;
  density: number;
  restitution: number;
  friction: number;
  frictionStatic: number;
  frictionAir: number;
  slop: number;
  isStatic: boolean;
  isSensor: boolean;
  isSleeping: boolean;
  collisionFilter: {
    category: number;
    mask: number;
    group: number;
  };
  render: ISerializedBodyRenderOptions;
  plugin: ISerializedCustomBodyPlugin; // Our custom plugin data
  // Consider bounds if needed, though they are derived
  // bounds: { min: ISerializedVector; max: ISerializedVector };
}

export interface ISerializedPhysicsEngineState {
  simulationTick: number; // Number of simulation steps taken
  fixedTimeStepMs: number;
  accumulatedTime: number;
  G: number;
  internalLoggingEnabled: boolean;
  ownsEngine: boolean; // Metadata about the engine setup
  celestialBodies: ICelestialBodyData[];
  world: {
    bodies: ISerializedMatterBody[];
    // Could also include composites if needed, or other world properties like gravity (though our engine manages it)
  };
}
