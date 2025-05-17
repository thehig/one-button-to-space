import { IScenario, ScenarioBodyInitialState, ScenarioBodyType } from "./types";
import { ICelestialBody } from "../PhysicsEngine";

const baseEccentricOrbitCelestial: ICelestialBody[] = [
  {
    id: "large-planet-eccentric-orbit-scenario",
    mass: 5.972e2, // Reduced mass significantly
    position: { x: 0, y: 0 },
    gravityRadius: 1000 * 10,
    radius: 1000 / 2,
  },
];

const baseEccentricOrbitSatellite: ScenarioBodyInitialState = {
  id: "eccentricSatelliteScenario",
  type: "circle" as ScenarioBodyType,
  label: "eccentricSatellite",
  initialPosition: { x: 1000, y: 0 },
  initialVelocity: { x: 0.1, y: 0.6 }, // Added small outward X, adjusted Y
  radius: 5,
  options: {
    density: 0.01,
    frictionAir: 0,
  },
};

const baseEccentricOrbitScenario: Omit<
  IScenario,
  "id" | "description" | "simulationSteps"
> = {
  name: "Base Eccentric Orbit Scenario",
  engineSettings: {
    customG: 0.001,
    enableInternalLogging: false, // Keep internal logging off by default for base
  },
  celestialBodies: baseEccentricOrbitCelestial,
  initialBodies: [baseEccentricOrbitSatellite],
  actions: [],
};

export const eccentricOrbitScenario1Step: IScenario = {
  ...baseEccentricOrbitScenario,
  id: "eccentric-orbit-1-step",
  name: "Eccentric Orbit (1 Step)",
  description: "Tests an eccentric orbit for 1 simulation step.",
  simulationSteps: 1,
};

export const eccentricOrbitScenario10Steps: IScenario = {
  ...baseEccentricOrbitScenario,
  id: "eccentric-orbit-10-steps",
  name: "Eccentric Orbit (10 Steps)",
  description: "Tests an eccentric orbit for 10 simulation steps.",
  simulationSteps: 10,
};

export const eccentricOrbitScenario50Steps: IScenario = {
  ...baseEccentricOrbitScenario,
  id: "eccentric-orbit-50-steps",
  name: "Eccentric Orbit (50 Steps)",
  description: "Tests an eccentric orbit for 50 simulation steps.",
  simulationSteps: 50,
};

export const eccentricOrbitScenario250Steps: IScenario = {
  ...baseEccentricOrbitScenario,
  id: "eccentric-orbit-250-steps",
  name: "Eccentric Orbit (250 Steps)",
  description: "Tests an eccentric orbit for 250 simulation steps.",
  simulationSteps: 250, // Reduced from original 5000 for snapshot brevity
};
