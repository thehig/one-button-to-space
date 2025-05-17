import { IScenario } from "./types";
import { ICelestialBody } from "../PhysicsEngine";

export const gravityPullVeryLargeBodyScenario: IScenario = {
  id: "gravity-pull-very-large-body",
  description:
    "Tests gravitational pull from a VERY large celestial body on a satellite.",
  engineSettings: {
    // Default G, default timestep
  },
  celestialBodies: [
    {
      id: "super-earth-gravity-pull",
      mass: 5.972e11,
      position: { x: 0, y: 0 },
      gravityRadius: 50000,
      radius: 12000,
    },
  ],
  initialBodies: [
    {
      id: "satelliteGPVeryLarge",
      type: "circle",
      label: "satellite-far",
      initialPosition: { x: 20000, y: 0 },
      radius: 5,
      options: {
        density: 0.01,
      },
    },
  ],
  actions: [],
  simulationSteps: 5,
};
