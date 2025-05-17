import { IScenario } from "../types";
import { ICelestialBody } from "../../PhysicsEngine"; // ICelestialBody is not used by this scenario, but good to keep pattern if others need it

export const determinismBaseScenario: IScenario = {
  id: "determinism-base",
  name: "Determinism Base Scenario",
  description:
    "Base scenario for determinism and snapshot tests. Creates a box, applies a force, and runs for 10 steps.",
  engineSettings: {
    // Using default fixedTimeStepMs (1000/60) and default G (0.001)
    // No internal logging needed for this base scenario by default
  },
  celestialBodies: [], // No celestial bodies for this simple test
  initialBodies: [
    {
      id: "testBox1",
      type: "box",
      label: "testBox", // Matches label in original runStandardSimulation
      initialPosition: { x: 0, y: 0 },
      width: 10,
      height: 10,
      options: {
        render: {
          fillStyle: "#ABCDEF",
        },
      },
    },
  ],
  actions: [
    {
      step: 0, // Apply before the first simulation step
      targetBodyId: "testBox1",
      actionType: "applyForce",
      force: { x: 10, y: 0 },
      applicationPoint: { x: 0, y: 0 }, // Applied at the body's initial center
    },
  ],
  simulationSteps: 10,
  snapshotSteps: [1, 10], // Snapshot at the end of the simulationSteps
};
