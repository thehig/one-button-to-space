import { IScenario } from "./types";
import { ICelestialBody } from "../PhysicsEngine";

export const eccentricOrbitScenario: IScenario = {
  id: "eccentric-orbit-large-body",
  description: "Tests an eccentric orbit around a large celestial body.",
  engineSettings: {
    customG: 0.001,
    enableInternalLogging: false,
  },
  celestialBodies: [
    {
      id: "large-planet-eccentric-orbit-scenario",
      mass: 5.972e3,
      position: { x: 0, y: 0 },
      gravityRadius: 1000 * 10,
      radius: 1000 / 2,
    },
  ],
  initialBodies: [
    {
      id: "eccentricSatelliteScenario",
      type: "circle",
      label: "eccentricSatellite",
      initialPosition: { x: 1000, y: 0 },
      initialVelocity: { x: 0.05, y: 0.5 },
      radius: 5,
      options: {
        density: 0.01,
        frictionAir: 0,
      },
    },
  ],
  actions: [],
  simulationSteps: 5000,
};
