import { IScenario, ScenarioAction } from "./types";

const baseRotationActions: ScenarioAction[] = [
  {
    step: 0, // Apply force at the beginning of the first step
    targetBodyId: "rotationBox",
    actionType: "applyForce",
    force: { x: 50, y: 0 }, // Force to the right
    applicationPoint: { x: 0, y: -5 }, // Apply slightly below center to cause rotation
  },
];

const baseRotationScenario: Omit<
  IScenario,
  "id" | "description" | "simulationSteps"
> = {
  engineSettings: {},
  celestialBodies: [],
  initialBodies: [
    {
      id: "rotationBox",
      type: "box",
      label: "testRotationBox",
      initialPosition: { x: 0, y: 0 },
      width: 20,
      height: 20,
    },
  ],
  actions: baseRotationActions,
};

export const rotationScenario1Step: IScenario = {
  ...baseRotationScenario,
  id: "rotation-test-1-step",
  description: "Tests applying an off-center force for 1 simulation step.",
  simulationSteps: 1,
};

export const rotationScenario10Steps: IScenario = {
  ...baseRotationScenario,
  id: "rotation-test-10-steps",
  description: "Tests applying an off-center force for 10 simulation steps.",
  simulationSteps: 10,
};

export const rotationScenario50Steps: IScenario = {
  ...baseRotationScenario,
  id: "rotation-test-50-steps",
  description: "Tests applying an off-center force for 50 simulation steps.",
  simulationSteps: 50,
};

export const rotationScenario100Steps: IScenario = {
  ...baseRotationScenario,
  id: "rotation-test-100-steps",
  description: "Tests applying an off-center force for 100 simulation steps.",
  simulationSteps: 100,
};
