import {
  IScenario,
  ScenarioAction,
  ScenarioBodyInitialState,
  ScenarioBodyType,
} from "../types";

const baseInitialBox: ScenarioBodyInitialState = {
  id: "rotationTestBox",
  type: "box" as ScenarioBodyType,
  label: "testRotationBox",
  initialPosition: { x: 0, y: 0 },
  initialAngle: 0,
  initialAngularVelocity: 0,
  width: 10,
  height: 20, // Make it non-square to easily see rotation
  options: {
    density: 1,
  },
};

const baseRotationAction: ScenarioAction[] = [
  {
    step: 0,
    targetBodyId: "rotationTestBox",
    actionType: "applyForce",
    force: { x: 10, y: 0 },
    applicationPoint: { x: 0, y: 5 },
  },
];

export const rotationScenario: IScenario = {
  id: "rotation-test",
  name: "Rotation Test",
  description: "Tests body rotation at various simulation steps.",
  engineSettings: {
    customG: 0, // No gravity
  },
  celestialBodies: [],
  initialBodies: [baseInitialBox],
  actions: baseRotationAction,
  simulationSteps: 100,
  snapshotSteps: [1, 10, 50, 100, 200, 300, 400, 500, 1000],
};
