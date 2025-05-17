import { IScenario } from "./types";
import { ICelestialBody } from "../PhysicsEngine";

export const gravityPullSmallBodyScenario: IScenario = {
  id: "gravity-pull-small-body",
  description:
    "Tests gravitational pull from a SMALL celestial body on a satellite.",
  engineSettings: {
    // Default G, default timestep
  },
  celestialBodies: [
    {
      id: "small-planet-gravity-pull",
      mass: 5.972e5,
      position: { x: 0, y: 0 },
      gravityRadius: 1000,
      radius: 100,
    },
  ],
  initialBodies: [
    {
      id: "satelliteGPSmall",
      type: "circle",
      label: "satellite-close",
      initialPosition: { x: 200, y: 0 },
      radius: 2,
      options: {
        density: 0.01,
      },
    },
  ],
  actions: [],
  simulationSteps: 5,
};
