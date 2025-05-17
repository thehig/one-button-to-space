import {
  IScenario,
  ScenarioBodyInitialState,
  ScenarioBodyType,
} from "../types";
import { ICelestialBody } from "../../PhysicsEngine";

const baseCelestialBodyVeryLarge: ICelestialBody[] = [
  {
    id: "very-large-star-gravity-test",
    mass: 1.989e9, // Very large star mass (e.g., 1000x Sun)
    position: { x: 0, y: 0 },
    gravityRadius: 6957000 * 10, // 10x larger Sun radius * 10
    radius: 6957000, // 10x larger Sun radius
    hasAtmosphere: false,
  },
];

const baseInitialSatelliteVeryLargeGravity: ScenarioBodyInitialState = {
  id: "gravityTestSatelliteVeryLarge",
  type: "circle" as ScenarioBodyType,
  label: "testSatellite_gravityVeryLarge",
  initialPosition: { x: 6957000 * 2, y: 0 }, // Start at 2 radii
  initialVelocity: { x: 0, y: 0 },
  radius: 1000,
  options: {
    density: 0.01,
  },
};

export const gravityPullVeryLargeBodyScenario: IScenario = {
  id: "gravity-pull-very-large-body-test",
  name: "Gravity Pull (Very Large Body) Test",
  description: "Tests gravitational pull from a very large celestial body.",
  engineSettings: {},
  celestialBodies: baseCelestialBodyVeryLarge,
  initialBodies: [baseInitialSatelliteVeryLargeGravity],
  actions: [],
  simulationSteps: 100,
  snapshotSteps: [1, 10, 50, 100, 200, 300, 400, 500, 1000],
};
