import { IScenario, ICustomBodyPlugin } from "./types";
import { ICelestialBody } from "../PhysicsEngine";

export const denseAtmosphereDragScenario: IScenario = {
  id: "dense-atmospheric-drag-test",
  description: "Tests atmospheric drag in a very dense atmosphere.",
  engineSettings: {
    // Default engine settings
  },
  celestialBodies: [
    {
      id: "dense-planet-drag-test",
      mass: 0,
      position: { x: 0, y: 0 },
      gravityRadius: 6371000 * 10,
      radius: 6371000,
      hasAtmosphere: true,
      atmosphereLimitAltitude: 100000,
      surfaceAirDensity: 122.5,
      scaleHeight: 8500,
    },
  ],
  initialBodies: [
    {
      id: "denseDragTestBody",
      type: "box",
      label: "testDenseDragBody",
      initialPosition: { x: 6371000 + 50000, y: 0 },
      initialVelocity: { x: -1000, y: 0 },
      width: 1,
      height: 1,
      options: {
        density: 8,
        plugin: {
          dragCoefficientArea: 0.5,
          effectiveNoseRadius: 0.1,
        } as ICustomBodyPlugin,
      },
    },
  ],
  actions: [],
  simulationSteps: 1,
};
