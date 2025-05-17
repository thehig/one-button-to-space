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
}

export type ScenarioActionType = "applyForce"; // Future: "setVelocity", "setAngle", "createBody", etc.

export interface ScenarioAction {
  step: number; // The simulation step number at which this action occurs (e.g., 0 for before the first step)
  targetBodyId: string; // ID of the body this action applies to
  actionType: ScenarioActionType;
  // Parameters for specific actions - extend with a union type if more actions are added
  force?: Matter.Vector; // For applyForce
  applicationPoint?: Matter.Vector; // For applyForce (world coordinates)
}

export interface ScenarioEngineSettings {
  fixedTimeStepMs?: number;
  customG?: number;
  enableInternalLogging?: boolean;
}

export interface IScenario {
  id: string; // Unique identifier for the scenario
  description: string;
  engineSettings?: ScenarioEngineSettings;
  celestialBodies?: ICelestialBody[];
  initialBodies: ScenarioBodyInitialState[];
  actions?: ScenarioAction[];
  simulationSteps: number; // Total number of fixed steps to run for the main simulation phase
  // Expected outcomes could be defined here for programmatic validation,
  // or handled by the test runner consuming the scenario.
  // For now, assertions will remain in the .spec.ts files.
}
