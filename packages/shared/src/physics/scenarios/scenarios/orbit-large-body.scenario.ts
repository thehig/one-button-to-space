import {
  IScenario,
  ScenarioBodyInitialState,
  ScenarioBodyType,
} from "../types";
import { ICelestialBody } from "../../PhysicsEngine";

const baseCelestialBodyLargeOrbit: ICelestialBody[] = [
  {
    id: "earth-like-planet-orbit-test",
    mass: 5.972e6, // Earth-like mass
    position: { x: 0, y: 0 },
    gravityRadius: 6371000 * 20, // Earth radius * 20
    radius: 6371000, // Earth radius
    hasAtmosphere: false,
  },
];

const baseInitialSatelliteLargeOrbit: ScenarioBodyInitialState = {
  id: "orbitTestSatelliteLarge",
  type: "circle" as ScenarioBodyType,
  label: "testSatellite_orbitLarge",
  initialPosition: { x: 6371000 + 700000, y: 0 }, // 700km altitude over Earth-like planet
  initialVelocity: { x: 0, y: 7500 }, // Approx LEO speed
  radius: 10,
  options: {
    density: 1,
  },
};

export const orbitLargeBodyScenario: IScenario = {
  id: "orbit-large-body-test",
  name: "Orbit (Large Body) Test",
  description: "Tests orbit around a large celestial body.",
  engineSettings: {
    customG: 6.674e-11,
    fixedTimeStepMs: 1000,
  },
  celestialBodies: baseCelestialBodyLargeOrbit,
  initialBodies: [baseInitialSatelliteLargeOrbit],
  actions: [],
  simulationSteps: 250,
  snapshotSteps: [1, 10, 50, 250],
};
