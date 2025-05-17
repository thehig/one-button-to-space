import {
  IScenario,
  ScenarioBodyInitialState,
  ScenarioBodyType,
} from "../types";
import { ICelestialBody } from "../../PhysicsEngine";

const baseCelestialBodySmallOrbit: ICelestialBody[] = [
  {
    id: "small-planet-orbit-test",
    mass: 5.972e3, // Small planet mass (scaled down for faster orbit)
    position: { x: 0, y: 0 },
    gravityRadius: 637100 * 20, // Scaled radius
    radius: 637100, // Scaled radius
    hasAtmosphere: false,
  },
];

const baseInitialSatelliteSmallOrbit: ScenarioBodyInitialState = {
  id: "orbitTestSatelliteSmall",
  type: "circle" as ScenarioBodyType,
  label: "testSatellite_orbitSmall",
  initialPosition: { x: 637100 + 70000, y: 0 }, // Scaled altitude
  initialVelocity: { x: 0, y: 2500 }, // Adjusted speed for smaller body/orbit
  radius: 10,
  options: {
    density: 1,
  },
};

export const orbitSmallBodyScenario: IScenario = {
  id: "orbit-small-body-test",
  name: "Orbit (Small Body) Test",
  description: "Tests orbit around a small celestial body.",
  engineSettings: {
    customG: 6.674e-11,
    fixedTimeStepMs: 1000,
  },
  celestialBodies: baseCelestialBodySmallOrbit,
  initialBodies: [baseInitialSatelliteSmallOrbit],
  actions: [],
  simulationSteps: 250,
  snapshotSteps: [1, 10, 50, 250],
};
