import {
  IScenario,
  ICustomBodyPlugin,
  ScenarioBodyInitialState,
  ScenarioBodyType,
} from "../types";
import { ICelestialBody } from "../../PhysicsEngine";

const baseCelestialBodyDense: ICelestialBody[] = [
  {
    id: "earth-like-dense-drag-test",
    mass: 0,
    position: { x: 0, y: 0 },
    gravityRadius: 6371000 * 10,
    radius: 6371000,
    hasAtmosphere: true,
    atmosphereLimitAltitude: 100000,
    surfaceAirDensity: 1.225 * 100, // 100x denser
    scaleHeight: 8500,
  },
];

const baseInitialBodyDense: ScenarioBodyInitialState = {
  id: "denseDragTestBody",
  type: "box" as ScenarioBodyType,
  label: "testDenseDragBody",
  initialPosition: { x: 6371000 + 50000, y: 0 },
  initialVelocity: { x: -100, y: 0 }, // Reduced speed for denser atmosphere
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

export const denseAtmosphereDragScenario: IScenario = {
  id: "dense-atmospheric-drag-test",
  name: "Dense Atmospheric Drag Test",
  description:
    "Tests atmospheric drag in a very dense atmosphere at various steps.",
  engineSettings: {},
  celestialBodies: baseCelestialBodyDense,
  initialBodies: [baseInitialBodyDense],
  actions: [],
  simulationSteps: 100,
  snapshotSteps: [1, 10, 50, 100, 200, 300, 400, 500, 1000],
};
