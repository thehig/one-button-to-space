import { IScenario, ScenarioBodyInitialState, ScenarioBodyType } from "./types";
import { ICelestialBody } from "../PhysicsEngine";

const baseGravityPullVeryLargeBodyCelestial: ICelestialBody[] = [
  {
    id: "super-earth-gravity-pull",
    mass: 5.972e11, // Very large mass
    position: { x: 0, y: 0 },
    gravityRadius: 50000,
    radius: 12000,
  },
];

const baseGravityPullVeryLargeBodySatellite: ScenarioBodyInitialState = {
  id: "satelliteGPVeryLarge",
  type: "circle" as ScenarioBodyType,
  label: "satellite-far",
  initialPosition: { x: 20000, y: 0 }, // Further initial position for very large body
  radius: 5,
  options: {
    density: 0.01,
  },
};

const baseGravityPullVeryLargeBodyScenario: Omit<
  IScenario,
  "id" | "description" | "simulationSteps"
> = {
  engineSettings: {
    // Default G, default timestep
  },
  celestialBodies: baseGravityPullVeryLargeBodyCelestial,
  initialBodies: [baseGravityPullVeryLargeBodySatellite],
  actions: [],
};

export const gravityPullVeryLargeBodyScenario1Step: IScenario = {
  ...baseGravityPullVeryLargeBodyScenario,
  id: "gravity-pull-very-large-body-1-step",
  description:
    "Tests gravitational pull from a very large body for 1 simulation step.",
  simulationSteps: 1,
};

export const gravityPullVeryLargeBodyScenario10Steps: IScenario = {
  ...baseGravityPullVeryLargeBodyScenario,
  id: "gravity-pull-very-large-body-10-steps",
  description:
    "Tests gravitational pull from a very large body for 10 simulation steps.",
  simulationSteps: 10,
};

export const gravityPullVeryLargeBodyScenario50Steps: IScenario = {
  ...baseGravityPullVeryLargeBodyScenario,
  id: "gravity-pull-very-large-body-50-steps",
  description:
    "Tests gravitational pull from a very large body for 50 simulation steps.",
  simulationSteps: 50,
};

export const gravityPullVeryLargeBodyScenario100Steps: IScenario = {
  ...baseGravityPullVeryLargeBodyScenario,
  id: "gravity-pull-very-large-body-100-steps",
  description:
    "Tests gravitational pull from a very large body for 100 simulation steps.",
  simulationSteps: 100,
};
