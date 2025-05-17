import {
  IScenario,
  ICustomBodyPlugin,
  // ScenarioAction, // Unused in this consolidated version
  ScenarioBodyInitialState,
  ScenarioBodyType,
} from "../types";
import { ICelestialBody } from "../../PhysicsEngine"; // Reverted to ICelestialBody

const baseCelestialBody: ICelestialBody[] = [
  {
    id: "earth-like-drag-test",
    mass: 0, // Mass set to 0 to isolate drag effect
    position: { x: 0, y: 0 },
    gravityRadius: 6371000 * 10,
    radius: 6371000,
    hasAtmosphere: true,
    atmosphereLimitAltitude: 100000,
    surfaceAirDensity: 1.225,
    scaleHeight: 8500,
  },
];

const baseInitialBody: ScenarioBodyInitialState = {
  id: "dragTestBody",
  type: "box" as ScenarioBodyType,
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
    } as ICustomBodyPlugin,
  },
};

// Consolidated scenario definition
export const atmosphericDragScenario: IScenario = {
  id: "atmospheric-drag-test", // Base ID
  name: "Atmospheric Drag Test", // Generic name
  description: "Tests atmospheric drag at various simulation steps.",
  engineSettings: {},
  celestialBodies: baseCelestialBody,
  initialBodies: [baseInitialBody],
  actions: [],
  simulationSteps: 100, // Max steps for this scenario configuration
  snapshotSteps: [1, 10, 50, 100], // Steps at which to take snapshots
};

// Remove old individual exports
// export const atmosphericDragScenario1Step: IScenario = { ... };
// export const atmosphericDragScenario10Steps: IScenario = { ... };
// export const atmosphericDragScenario50Steps: IScenario = { ... };
// export const atmosphericDragScenario100Steps: IScenario = { ... };
