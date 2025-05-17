import { IScenario } from "./types";

export const thrustScenario: IScenario = {
  id: "thrust-test",
  description: "Tests applying an upward thrust to a rocket body for one step.",
  engineSettings: {
    // Default engine settings
  },
  celestialBodies: [],
  initialBodies: [
    {
      id: "thrustRocket",
      type: "rocket", // This will use engine.createRocketBody()
      label: "testRocketThrust",
      initialPosition: { x: 0, y: 0 },
      // createRocketBody sets default density, frictionAir, etc.
      // If specific options were needed, they'd go into the options property here.
    },
  ],
  actions: [
    {
      step: 0, // Apply force at the beginning of the first step (before engine.fixedStep call)
      targetBodyId: "thrustRocket",
      actionType: "applyForce",
      force: { x: 0, y: -100 }, // Upward thrust
      applicationPoint: { x: 0, y: 0 },
    },
  ],
  simulationSteps: 1,
};
