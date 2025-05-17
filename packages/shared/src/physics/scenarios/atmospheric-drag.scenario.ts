import { IScenario, ICustomBodyPlugin } from "./types"; // ICustomBodyPlugin might be needed if options are typed strictly
import { ICelestialBody } from "../PhysicsEngine";

export const atmosphericDragScenario: IScenario = {
  id: "atmospheric-drag-test",
  description: "Tests atmospheric drag on a body moving through an atmosphere.",
  engineSettings: {
    // Default engine settings
  },
  celestialBodies: [
    {
      id: "earth-like-drag-test",
      mass: 0, // Mass set to 0 to isolate drag effect
      position: { x: 0, y: 0 },
      gravityRadius: 6371000 * 10, // Matches original test
      radius: 6371000,
      hasAtmosphere: true,
      atmosphereLimitAltitude: 100000,
      surfaceAirDensity: 1.225,
      scaleHeight: 8500,
    },
  ],
  initialBodies: [
    {
      id: "dragTestBody",
      type: "box",
      label: "testDragBody",
      initialPosition: { x: 6371000 + 50000, y: 0 },
      initialVelocity: { x: -1000, y: 0 },
      width: 1,
      height: 1,
      options: {
        density: 8,
        plugin: {
          dragCoefficientArea: 0.5,
          effectiveNoseRadius: 0.1,
        } as ICustomBodyPlugin, // Cast if ICustomBodyPlugin is imported and options are strictly typed
      },
    },
  ],
  actions: [],
  simulationSteps: 1,
};
