import { IScenario } from "./types";
import { ICelestialBody } from "../PhysicsEngine";

export const orbitLargeBodyScenario: IScenario = {
  id: "orbit-large-body",
  description: "Tests an object orbiting a large celestial body.",
  engineSettings: {
    customG: 0.001,
  },
  celestialBodies: [
    {
      id: "earth-orbit-test-large",
      mass: 5.972e5,
      position: { x: 0, y: 0 },
      gravityRadius: 100000,
      radius: 6371,
    },
  ],
  initialBodies: [
    {
      id: "orbitingSatelliteLarge",
      type: "circle",
      label: "orbitingSatellite",
      initialPosition: { x: 10000, y: 0 },
      initialVelocity: { x: 0, y: 0.24 },
      radius: 5,
      options: {
        density: 0.01,
        frictionAir: 0,
      },
    },
  ],
  actions: [],
  simulationSteps: 75,
};
