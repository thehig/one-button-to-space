import {
  IScenario,
  ICustomBodyPlugin,
  ScenarioBodyInitialState,
  ScenarioBodyType,
} from "./types";
import { ICelestialBody } from "../PhysicsEngine";

const baseCelestialBody: ICelestialBody[] = [
  {
    id: "earth-like-orbit-test",
    mass: 5.972e6, // Increased mass for more pronounced orbital mechanics. Original was 5.972e2
    position: { x: 0, y: 0 },
    gravityRadius: 6371000 * 50, // Extended gravity radius
    radius: 6371000,
    hasAtmosphere: false, // No atmosphere for pure orbit test
  },
];

const baseInitialSatellite: ScenarioBodyInitialState = {
  id: "orbitTestSatellite",
  type: "circle" as ScenarioBodyType,
  label: "testOrbitSatellite",
  initialPosition: { x: 6371000 + 700000, y: 0 }, // 700km altitude
  initialVelocity: { x: 0, y: 7500 }, // Approx LEO speed (m/s). Original was x: 0.1, y: 0.6 - too slow
  radius: 1,
  options: {
    density: 10, // Density in kg/m^3 (arbitrary for test)
    plugin: {
      // No specific plugin needed for basic orbit
    } as ICustomBodyPlugin,
  },
};

// Consolidated scenario definition
export const eccentricOrbitScenario: IScenario = {
  id: "eccentric-orbit-test",
  name: "Eccentric Orbit Test",
  description: "Tests eccentric orbit at various simulation steps.",
  engineSettings: {
    customG: 6.674e-11, // Use realistic G for orbital mechanics
    fixedTimeStepMs: 1000, // 1 second per step for orbital scale
    enableInternalLogging: false,
  },
  celestialBodies: baseCelestialBody,
  initialBodies: [baseInitialSatellite],
  actions: [],
  simulationSteps: 250, // Max steps for this scenario configuration
  snapshotSteps: [1, 10, 50, 250], // Steps at which to take snapshots
};

// Remove old individual exports
