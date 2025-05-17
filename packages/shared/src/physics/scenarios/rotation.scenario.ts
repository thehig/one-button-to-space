import { IScenario } from "./types";

export const rotationScenario: IScenario = {
  id: "rotation-test",
  description:
    "Tests applying an off-center force to a box to induce rotation.",
  engineSettings: {
    // Default engine settings
  },
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
  actions: [
    {
      step: 0, // Apply force at the beginning of the first step
      targetBodyId: "rotationBox",
      actionType: "applyForce",
      force: { x: 50, y: 0 }, // Force to the right
      applicationPoint: { x: 0, y: -5 },
    },
  ],
  simulationSteps: 1,
};
