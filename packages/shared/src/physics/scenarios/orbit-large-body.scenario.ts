import { IScenario, ScenarioBodyInitialState, ScenarioBodyType } from "./types";
import { ICelestialBody } from "../PhysicsEngine";

const baseOrbitLargeBodyCelestial: ICelestialBody[] = [
  {
    id: "earth-orbit-test-large",
    mass: 5.972e5, // Large mass for orbit test
    position: { x: 0, y: 0 },
    gravityRadius: 100000,
    radius: 6371,
  },
];

const baseOrbitLargeBodySatellite: ScenarioBodyInitialState = {
  id: "orbitingSatelliteLarge",
  type: "circle" as ScenarioBodyType,
  label: "orbitingSatellite",
  initialPosition: { x: 10000, y: 0 },
  initialVelocity: { x: 0, y: 0.24 }, // Tuned for a somewhat circular orbit
  radius: 5,
  options: {
    density: 0.01,
    frictionAir: 0, // No air friction for orbit tests
  },
};

const baseOrbitLargeBodyScenario: Omit<
  IScenario,
  "id" | "description" | "simulationSteps"
> = {
  engineSettings: {
    customG: 0.001, // Consistent G for orbit tests
    // fixedTimeStepMs: 1000 / 60, // Default timestep
  },
  celestialBodies: baseOrbitLargeBodyCelestial,
  initialBodies: [baseOrbitLargeBodySatellite],
  actions: [],
};

export const orbitLargeBodyScenario1Step: IScenario = {
  ...baseOrbitLargeBodyScenario,
  id: "orbit-large-body-1-step",
  description: "Tests orbit around a large body for 1 simulation step.",
  simulationSteps: 1,
  engineSettings: {
    ...baseOrbitLargeBodyScenario.engineSettings,
    customG: 0.1,
  },
};

export const orbitLargeBodyScenario10Steps: IScenario = {
  ...baseOrbitLargeBodyScenario,
  id: "orbit-large-body-10-steps",
  description: "Tests orbit around a large body for 10 simulation steps.",
  simulationSteps: 10,
};

export const orbitLargeBodyScenario50Steps: IScenario = {
  ...baseOrbitLargeBodyScenario,
  id: "orbit-large-body-50-steps",
  description: "Tests orbit around a large body for 50 simulation steps.",
  simulationSteps: 50,
};

// For longer orbits, we might need more steps to see a significant portion of the orbit
export const orbitLargeBodyScenario250Steps: IScenario = {
  // Changed from 100 to 250 for better orbit visibility
  ...baseOrbitLargeBodyScenario,
  id: "orbit-large-body-250-steps",
  description: "Tests orbit around a large body for 250 simulation steps.",
  simulationSteps: 250, // Increased steps for orbit
};
