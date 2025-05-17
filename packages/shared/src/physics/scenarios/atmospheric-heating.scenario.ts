import {
  IScenario,
  ICustomBodyPlugin,
  ScenarioBodyInitialState,
  ScenarioBodyType,
} from "./types";
import { ICelestialBody } from "../PhysicsEngine";

const baseAtmosphericHeatingCelestial: ICelestialBody[] = [
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
];

const baseAtmosphericHeatingBody: ScenarioBodyInitialState = {
  id: "heatingTestBody",
  type: "box" as ScenarioBodyType,
  label: "testEntryBodyHeating",
  initialPosition: { x: 6371000 + 90000, y: 0 }, // Start at 90km altitude
  initialVelocity: { x: -7000, y: 0 }, // Re-entry speed
  width: 1,
  height: 1,
  options: {
    plugin: {
      effectiveNoseRadius: 0.5,
      dragCoefficientArea: 0.1, // This was in the original, ensure it's used or remove if not needed for heating
    } as ICustomBodyPlugin,
  },
};

const baseAtmosphericHeatingScenario: Omit<
  IScenario,
  "id" | "description" | "simulationSteps"
> = {
  engineSettings: {
    // Default engine settings
  },
  celestialBodies: baseAtmosphericHeatingCelestial,
  initialBodies: [baseAtmosphericHeatingBody],
  actions: [],
};

export const atmosphericHeatingScenario1Step: IScenario = {
  ...baseAtmosphericHeatingScenario,
  id: "atmospheric-heating-1-step",
  description: "Tests atmospheric heating for 1 simulation step.",
  simulationSteps: 1,
};

export const atmosphericHeatingScenario10Steps: IScenario = {
  ...baseAtmosphericHeatingScenario,
  id: "atmospheric-heating-10-steps",
  description: "Tests atmospheric heating for 10 simulation steps.",
  simulationSteps: 10,
  // Potentially adjust initial position/velocity for longer runs if needed to stay in atmosphere
};

export const atmosphericHeatingScenario50Steps: IScenario = {
  ...baseAtmosphericHeatingScenario,
  id: "atmospheric-heating-50-steps",
  description: "Tests atmospheric heating for 50 simulation steps.",
  simulationSteps: 50,
};

export const atmosphericHeatingScenario100Steps: IScenario = {
  ...baseAtmosphericHeatingScenario,
  id: "atmospheric-heating-100-steps",
  description: "Tests atmospheric heating for 100 simulation steps.",
  simulationSteps: 100,
};
