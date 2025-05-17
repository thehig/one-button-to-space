import {
  IScenario,
  ICustomBodyPlugin,
  ScenarioBodyInitialState,
  ScenarioBodyType,
} from "./types";
import { ICelestialBody } from "../PhysicsEngine";

const baseDenseCelestialBody: ICelestialBody[] = [
  {
    id: "dense-planet-drag-test",
    mass: 0,
    position: { x: 0, y: 0 },
    gravityRadius: 6371000 * 10,
    radius: 6371000,
    hasAtmosphere: true,
    atmosphereLimitAltitude: 100000,
    surfaceAirDensity: 122.5, // Denser atmosphere
    scaleHeight: 8500,
  },
];

const baseDenseInitialBody: ScenarioBodyInitialState = {
  id: "denseDragTestBody",
  type: "box" as ScenarioBodyType,
  label: "testDenseDragBody",
  initialPosition: { x: 6371000 + 50000, y: 0 },
  initialVelocity: { x: -1000, y: 0 },
  width: 1,
  height: 1,
  options: {
    density: 8,
    plugin: {
      dragCoefficientArea: 0.5,
      effectiveNoseRadius: 0.1,
    } as ICustomBodyPlugin,
  },
};

const baseDenseAtmosphereDragScenario: Omit<
  IScenario,
  "id" | "description" | "simulationSteps"
> = {
  engineSettings: {},
  celestialBodies: baseDenseCelestialBody,
  initialBodies: [baseDenseInitialBody],
  actions: [],
};

export const denseAtmosphereDragScenario1Step: IScenario = {
  ...baseDenseAtmosphereDragScenario,
  id: "dense-atmospheric-drag-test-1-step",
  description: "Tests dense atmospheric drag for 1 simulation step.",
  simulationSteps: 1,
};

export const denseAtmosphereDragScenario10Steps: IScenario = {
  ...baseDenseAtmosphereDragScenario,
  id: "dense-atmospheric-drag-test-10-steps",
  description: "Tests dense atmospheric drag for 10 simulation steps.",
  simulationSteps: 10,
};

export const denseAtmosphereDragScenario50Steps: IScenario = {
  ...baseDenseAtmosphereDragScenario,
  id: "dense-atmospheric-drag-test-50-steps",
  description: "Tests dense atmospheric drag for 50 simulation steps.",
  simulationSteps: 50,
};

export const denseAtmosphereDragScenario100Steps: IScenario = {
  ...baseDenseAtmosphereDragScenario,
  id: "dense-atmospheric-drag-test-100-steps",
  description: "Tests dense atmospheric drag for 100 simulation steps.",
  simulationSteps: 100,
};
