import { IScenario, ScenarioBodyInitialState, ScenarioBodyType } from "./types";
import { ICelestialBody } from "../PhysicsEngine";

const baseGravityPullLargeBodyCelestial: ICelestialBody[] = [
  {
    id: "earth-gravity-pull-large",
    mass: 5.972e8,
    position: { x: 0, y: 0 },
    gravityRadius: 10000,
    radius: 6371,
  },
];

const baseGravityPullLargeBodySatellite: ScenarioBodyInitialState = {
  id: "satelliteGP",
  type: "circle" as ScenarioBodyType,
  label: "satellite",
  initialPosition: { x: 1000, y: 0 },
  // No initialVelocity, starts from rest relative to the system
  radius: 5,
  options: {
    density: 0.01,
  },
};

const baseGravityPullLargeBodyScenario: Omit<
  IScenario,
  "id" | "description" | "simulationSteps"
> = {
  engineSettings: {
    // Default G, default timestep
  },
  celestialBodies: baseGravityPullLargeBodyCelestial,
  initialBodies: [baseGravityPullLargeBodySatellite],
  actions: [],
};

export const gravityPullLargeBodyScenario1Step: IScenario = {
  ...baseGravityPullLargeBodyScenario,
  id: "gravity-pull-large-body-1-step",
  description:
    "Tests gravitational pull from a large body for 1 simulation step.",
  simulationSteps: 1,
};

export const gravityPullLargeBodyScenario10Steps: IScenario = {
  ...baseGravityPullLargeBodyScenario,
  id: "gravity-pull-large-body-10-steps",
  description:
    "Tests gravitational pull from a large body for 10 simulation steps.",
  simulationSteps: 10,
};

export const gravityPullLargeBodyScenario50Steps: IScenario = {
  ...baseGravityPullLargeBodyScenario,
  id: "gravity-pull-large-body-50-steps",
  description:
    "Tests gravitational pull from a large body for 50 simulation steps.",
  simulationSteps: 50,
};

export const gravityPullLargeBodyScenario100Steps: IScenario = {
  ...baseGravityPullLargeBodyScenario,
  id: "gravity-pull-large-body-100-steps",
  description:
    "Tests gravitational pull from a large body for 100 simulation steps.",
  simulationSteps: 100,
};
