import { IScenario, ScenarioBodyInitialState, ScenarioBodyType } from "./types";
import { ICelestialBody } from "../PhysicsEngine";

const baseOrbitSmallBodyCelestial: ICelestialBody[] = [
  {
    id: "small-planet-orbit-test",
    mass: 5.972e5, // Small planet mass
    position: { x: 0, y: 0 },
    gravityRadius: 5000,
    radius: 100,
  },
];

const baseOrbitSmallBodySatellite: ScenarioBodyInitialState = {
  id: "orbitingSatelliteSmall",
  type: "circle" as ScenarioBodyType,
  label: "smallOrbitingSatellite",
  initialPosition: { x: 400, y: 0 }, // Closer orbit for smaller body
  initialVelocity: { x: 0, y: 1.2 }, // Velocity tuned for this smaller system
  radius: 2,
  options: {
    density: 0.01,
    frictionAir: 0,
  },
};

const baseOrbitSmallBodyScenario: Omit<
  IScenario,
  "id" | "description" | "simulationSteps"
> = {
  engineSettings: {
    customG: 0.001, // Consistent G
  },
  celestialBodies: baseOrbitSmallBodyCelestial,
  initialBodies: [baseOrbitSmallBodySatellite],
  actions: [],
};

export const orbitSmallBodyScenario1Step: IScenario = {
  ...baseOrbitSmallBodyScenario,
  id: "orbit-small-body-1-step",
  description: "Tests orbit around a small body for 1 simulation step.",
  simulationSteps: 1,
  engineSettings: {
    ...baseOrbitSmallBodyScenario.engineSettings,
    customG: 0.1,
  },
};

export const orbitSmallBodyScenario10Steps: IScenario = {
  ...baseOrbitSmallBodyScenario,
  id: "orbit-small-body-10-steps",
  description: "Tests orbit around a small body for 10 simulation steps.",
  simulationSteps: 10,
};

export const orbitSmallBodyScenario50Steps: IScenario = {
  ...baseOrbitSmallBodyScenario,
  id: "orbit-small-body-50-steps",
  description: "Tests orbit around a small body for 50 simulation steps.",
  simulationSteps: 50,
};

export const orbitSmallBodyScenario250Steps: IScenario = {
  ...baseOrbitSmallBodyScenario,
  id: "orbit-small-body-250-steps",
  description: "Tests orbit around a small body for 250 simulation steps.",
  simulationSteps: 250,
};
