import {
  IScenario,
  ICustomBodyPlugin,
  ScenarioAction,
  ScenarioBodyInitialState,
  ScenarioBodyType,
} from "./types";
import { ICelestialBody } from "../PhysicsEngine";

const baseCelestialBody: ICelestialBody[] = [
  {
    id: "earth-like-drag-test",
    mass: 0, // Mass set to 0 to isolate drag effect
    position: { x: 0, y: 0 },
    gravityRadius: 6371000 * 10,
    radius: 6371000,
    hasAtmosphere: true,
    atmosphereLimitAltitude: 100000,
    surfaceAirDensity: 1.225,
    scaleHeight: 8500,
  },
];

const baseInitialBody: ScenarioBodyInitialState = {
  id: "dragTestBody",
  type: "box" as ScenarioBodyType,
  label: "testDragBody",
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

const baseAtmosphericDragScenario: Omit<
  IScenario,
  "id" | "description" | "simulationSteps"
> = {
  engineSettings: {},
  celestialBodies: baseCelestialBody,
  initialBodies: [baseInitialBody],
  actions: [],
};

export const atmosphericDragScenario1Step: IScenario = {
  ...baseAtmosphericDragScenario,
  id: "atmospheric-drag-test-1-step",
  description: "Tests atmospheric drag for 1 simulation step.",
  simulationSteps: 1,
};

export const atmosphericDragScenario10Steps: IScenario = {
  ...baseAtmosphericDragScenario,
  id: "atmospheric-drag-test-10-steps",
  description: "Tests atmospheric drag for 10 simulation steps.",
  simulationSteps: 10,
};

export const atmosphericDragScenario50Steps: IScenario = {
  ...baseAtmosphericDragScenario,
  id: "atmospheric-drag-test-50-steps",
  description: "Tests atmospheric drag for 50 simulation steps.",
  simulationSteps: 50,
};

export const atmosphericDragScenario100Steps: IScenario = {
  ...baseAtmosphericDragScenario,
  id: "atmospheric-drag-test-100-steps",
  description: "Tests atmospheric drag for 100 simulation steps.",
  simulationSteps: 100,
};
