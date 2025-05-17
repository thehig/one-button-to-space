import { IScenario, ScenarioAction } from "./types";

const baseThrustActions: ScenarioAction[] = [
  {
    step: 0, // Apply force at the beginning of the first step
    targetBodyId: "thrustRocket",
    actionType: "applyForce",
    force: { x: 0, y: -100 }, // Upward thrust
    applicationPoint: { x: 0, y: 0 },
  },
];

const baseThrustScenario: Omit<
  IScenario,
  "id" | "description" | "simulationSteps"
> = {
  name: "Base Thrust Scenario",
  engineSettings: {},
  celestialBodies: [],
  initialBodies: [
    {
      id: "thrustRocket",
      type: "rocket",
      label: "testRocketThrust",
      initialPosition: { x: 0, y: 0 },
    },
  ],
  actions: baseThrustActions,
};

export const thrustScenario1Step: IScenario = {
  ...baseThrustScenario,
  id: "thrust-test-1-step",
  name: "Thrust Test (1 Step)",
  description: "Tests applying thrust for 1 simulation step.",
  simulationSteps: 1,
};

export const thrustScenario10Steps: IScenario = {
  ...baseThrustScenario,
  id: "thrust-test-10-steps",
  name: "Thrust Test (10 Steps)",
  description: "Tests applying thrust for 10 simulation steps.",
  simulationSteps: 10,
};

export const thrustScenario50Steps: IScenario = {
  ...baseThrustScenario,
  id: "thrust-test-50-steps",
  name: "Thrust Test (50 Steps)",
  description: "Tests applying thrust for 50 simulation steps.",
  simulationSteps: 50,
};

export const thrustScenario100Steps: IScenario = {
  ...baseThrustScenario,
  id: "thrust-test-100-steps",
  name: "Thrust Test (100 Steps)",
  description: "Tests applying thrust for 100 simulation steps.",
  simulationSteps: 100,
};
