import {
  IScenario,
  ICustomBodyPlugin,
  ScenarioAction,
  ScenarioBodyInitialState,
  ScenarioBodyType,
} from "../types";
// ICelestialBody not needed for thrust in vacuum

const baseInitialRocket: ScenarioBodyInitialState = {
  id: "thrustTestRocket",
  type: "rocket" as ScenarioBodyType, // Assuming 'rocket' type is defined or handled
  label: "testRocket_thrust",
  initialPosition: { x: 0, y: 100 },
  initialVelocity: { x: 0, y: 0 },
  // width, height, radius might not be needed if 'rocket' type has defaults
  options: {
    density: 1,
    plugin: {
      // thrust, fuelMass, etc. could be here if ICustomBodyPlugin supports them
    } as ICustomBodyPlugin,
  },
};

const baseThrustAction: ScenarioAction[] = [
  {
    step: 0, // Apply at the beginning of each relevant step for continuous thrust, or just once
    targetBodyId: "thrustTestRocket",
    actionType: "applyForce", // Or a specific "applyThrust" if available
    force: { x: 0, y: -10 }, // Example: Upward thrust
    // applicationPoint might be offset if thrust is not from center of mass
  },
];

export const thrustScenario: IScenario = {
  id: "thrust-test",
  name: "Thrust Test",
  description: "Tests rocket thrust at various simulation steps.",
  engineSettings: {
    customG: 0, // No gravity to isolate thrust
  },
  celestialBodies: [],
  initialBodies: [baseInitialRocket],
  actions: baseThrustAction, // Apply the thrust action
  simulationSteps: 100,
  snapshotSteps: [1, 10, 50, 100],
};
