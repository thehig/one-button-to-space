import { IScenario } from "./types";
import { ICelestialBody } from "../PhysicsEngine";

export const gravityPullLargeBodyScenario: IScenario = {
  id: "gravity-pull-large-body",
  description:
    "Tests gravitational pull from a large celestial body on a satellite.",
  engineSettings: {
    // Default G, default timestep
  },
  celestialBodies: [
    {
      id: "earth-gravity-pull-large",
      mass: 5.972e8,
      position: { x: 0, y: 0 },
      gravityRadius: 10000,
      radius: 6371,
    },
  ],
  initialBodies: [
    {
      id: "satelliteGP",
      type: "circle",
      label: "satellite",
      initialPosition: { x: 1000, y: 0 },
      radius: 5,
      options: {
        density: 0.01,
      },
    },
  ],
  actions: [],
  simulationSteps: 5,
};
