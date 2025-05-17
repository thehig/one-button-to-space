import {
  IScenario,
  ScenarioBodyInitialState,
  ScenarioBodyType,
} from "../types";
import { ICelestialBody } from "../../PhysicsEngine";

const baseCelestialBodyLarge: ICelestialBody[] = [
  {
    id: "large-planet-gravity-test",
    mass: 5.972e6, // Earth-like mass (original was e24, scaled down for simulation speed)
    position: { x: 0, y: 0 },
    gravityRadius: 6371000 * 10, // Earth radius * 10
    radius: 6371000, // Earth radius
    hasAtmosphere: false,
  },
];

const baseInitialSatelliteLargeGravity: ScenarioBodyInitialState = {
  id: "gravityTestSatelliteLarge",
  type: "circle" as ScenarioBodyType,
  label: "testSatellite_gravityLarge",
  initialPosition: { x: 6371000 * 2, y: 0 }, // Start at 2 Earth radii
  initialVelocity: { x: 0, y: 0 },
  radius: 100,
  options: {
    density: 0.1,
  },
};

export const gravityPullLargeBodyScenario: IScenario = {
  id: "gravity-pull-large-body-test",
  name: "Gravity Pull (Large Body) Test",
  description: "Tests gravitational pull from a large celestial body.",
  engineSettings: {},
  celestialBodies: baseCelestialBodyLarge,
  initialBodies: [baseInitialSatelliteLargeGravity],
  actions: [],
  simulationSteps: 100,
  snapshotSteps: [1, 10, 50, 100, 200, 300, 400, 500, 1000],
};
