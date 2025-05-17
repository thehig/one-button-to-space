import { IScenario, ScenarioBodyInitialState, ScenarioBodyType } from "./types";
import { ICelestialBody } from "../PhysicsEngine";

const baseGravityPullSmallBodyCelestial: ICelestialBody[] = [
  {
    id: "small-planet-gravity-pull",
    mass: 5.972e5, // Small planet mass
    position: { x: 0, y: 0 },
    gravityRadius: 1000,
    radius: 100,
  },
];

const baseGravityPullSmallBodySatellite: ScenarioBodyInitialState = {
  id: "satelliteGPSmall",
  type: "circle" as ScenarioBodyType,
  label: "satellite-close",
  initialPosition: { x: 200, y: 0 }, // Closer initial position for smaller body
  // No initialVelocity, starts from rest relative to the system
  radius: 2,
  options: {
    density: 0.01,
  },
};

const baseGravityPullSmallBodyScenario: Omit<
  IScenario,
  "id" | "description" | "simulationSteps"
> = {
  engineSettings: {
    // Default G, default timestep
  },
  celestialBodies: baseGravityPullSmallBodyCelestial,
  initialBodies: [baseGravityPullSmallBodySatellite],
  actions: [],
};

export const gravityPullSmallBodyScenario1Step: IScenario = {
  ...baseGravityPullSmallBodyScenario,
  id: "gravity-pull-small-body-1-step",
  description:
    "Tests gravitational pull from a small body for 1 simulation step.",
  simulationSteps: 1,
};

export const gravityPullSmallBodyScenario10Steps: IScenario = {
  ...baseGravityPullSmallBodyScenario,
  id: "gravity-pull-small-body-10-steps",
  description:
    "Tests gravitational pull from a small body for 10 simulation steps.",
  simulationSteps: 10,
};

export const gravityPullSmallBodyScenario50Steps: IScenario = {
  ...baseGravityPullSmallBodyScenario,
  id: "gravity-pull-small-body-50-steps",
  description:
    "Tests gravitational pull from a small body for 50 simulation steps.",
  simulationSteps: 50,
};

export const gravityPullSmallBodyScenario100Steps: IScenario = {
  ...baseGravityPullSmallBodyScenario,
  id: "gravity-pull-small-body-100-steps",
  description:
    "Tests gravitational pull from a small body for 100 simulation steps.",
  simulationSteps: 100,
};
