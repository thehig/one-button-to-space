import { IScenario } from "./types";
import { ICelestialBody } from "../PhysicsEngine";

export const orbitSmallBodyScenario: IScenario = {
  id: "orbit-small-body",
  description: "Tests an object orbiting a SMALL celestial body.",
  engineSettings: {
    customG: 0.001,
  },
  celestialBodies: [
    {
      id: "small-planet-orbit-test",
      mass: 5.972e5,
      position: { x: 0, y: 0 },
      gravityRadius: 5000,
      radius: 100,
    },
  ],
  initialBodies: [
    {
      id: "orbitingSatelliteSmall",
      type: "circle",
      label: "smallOrbitingSatellite",
      initialPosition: { x: 400, y: 0 },
      radius: 2,
      options: {
        density: 0.01,
        frictionAir: 0,
      },
    },
  ],
  actions: [],
  simulationSteps: 30,
};
