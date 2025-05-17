import {
  IScenario,
  ICustomBodyPlugin,
  ScenarioBodyInitialState,
  ScenarioBodyType,
} from "../types";
import { ICelestialBody } from "../../PhysicsEngine";

const baseCelestialBodyHeating: ICelestialBody[] = [
  {
    id: "earth-like-heating-test",
    mass: 0, // No gravity for this test, isolate heating
    position: { x: 0, y: 0 },
    gravityRadius: 6371000 * 10,
    radius: 6371000,
    hasAtmosphere: true,
    atmosphereLimitAltitude: 100000,
    surfaceAirDensity: 1.225,
    scaleHeight: 8500,
  },
];

const baseInitialBodyHeating: ScenarioBodyInitialState = {
  id: "heatingTestBody",
  type: "box" as ScenarioBodyType,
  label: "testHeatingBody",
  initialPosition: { x: 6371000 + 80000, y: 0 }, // Start at 80km altitude
  initialVelocity: { x: -7000, y: 0 }, // High speed for significant heating
  width: 1,
  height: 1,
  options: {
    density: 1000, // Denser body for more pronounced heating effect if mass plays a role
    plugin: {
      dragCoefficientArea: 1.0, // Higher drag might lead to more heating
      effectiveNoseRadius: 0.5, // Larger nose radius
      currentHeatFlux: 0, // Start with no heat flux
    } as ICustomBodyPlugin,
  },
};

export const atmosphericHeatingScenario: IScenario = {
  id: "atmospheric-heating-test",
  name: "Atmospheric Heating Test",
  description: "Tests atmospheric heating at various simulation steps.",
  engineSettings: {},
  celestialBodies: baseCelestialBodyHeating,
  initialBodies: [baseInitialBodyHeating],
  actions: [],
  simulationSteps: 100,
  snapshotSteps: [1, 10, 50, 100],
};
