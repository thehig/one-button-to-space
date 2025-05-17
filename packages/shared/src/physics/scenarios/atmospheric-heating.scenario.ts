import { IScenario, ICustomBodyPlugin } from "./types";
import { ICelestialBody } from "../PhysicsEngine";

export const atmosphericHeatingScenario: IScenario = {
  id: "atmospheric-heating-test",
  description: "Tests atmospheric heating on a body re-entering an atmosphere.",
  engineSettings: {
    // Default engine settings
  },
  celestialBodies: [
    {
      id: "earth-like-heating-test",
      mass: 5.972e24, // kg
      position: { x: 0, y: 0 },
      gravityRadius: 6371000 * 10, // meters
      radius: 6371000, // meters
      hasAtmosphere: true,
      atmosphereLimitAltitude: 100000, // 100 km
      surfaceAirDensity: 1.225, // kg/m^3
      scaleHeight: 8500, // meters
    },
  ],
  initialBodies: [
    {
      id: "heatingTestBody",
      type: "box",
      label: "testEntryBodyHeating",
      initialPosition: { x: 6371000 + 90000, y: 0 },
      initialVelocity: { x: -7000, y: 0 },
      width: 1,
      height: 1,
      options: {
        plugin: {
          effectiveNoseRadius: 0.5,
          dragCoefficientArea: 0.1,
        } as ICustomBodyPlugin,
      },
    },
  ],
  actions: [],
  simulationSteps: 1,
};
