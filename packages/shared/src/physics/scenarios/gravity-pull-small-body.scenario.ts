import { IScenario, ScenarioBodyInitialState, ScenarioBodyType } from "./types";
import { ICelestialBody } from "../PhysicsEngine";

const baseCelestialBodySmall: ICelestialBody[] = [
  {
    id: "small-star-gravity-test",
    mass: 1.989e3, // Much smaller star mass (e.g., 1000x Earth)
    position: { x: 0, y: 0 },
    gravityRadius: 695700 * 10, // Approx Sun radius * 10
    radius: 695700, // Approx Sun radius
    hasAtmosphere: false,
  },
];

const baseInitialSatelliteSmallGravity: ScenarioBodyInitialState = {
  id: "gravityTestSatelliteSmall",
  type: "circle" as ScenarioBodyType,
  label: "testSatellite_gravitySmall",
  initialPosition: { x: 695700 * 2, y: 0 }, // Start at 2 radii distance
  initialVelocity: { x: 0, y: 0 }, // Start at rest
  radius: 100,
  options: {
    density: 0.1,
  },
};

export const gravityPullSmallBodyScenario: IScenario = {
  id: "gravity-pull-small-body-test",
  name: "Gravity Pull (Small Body) Test",
  description: "Tests gravitational pull from a small celestial body.",
  engineSettings: {},
  celestialBodies: baseCelestialBodySmall,
  initialBodies: [baseInitialSatelliteSmallGravity],
  actions: [],
  simulationSteps: 100,
  snapshotSteps: [1, 10, 50, 100],
};
