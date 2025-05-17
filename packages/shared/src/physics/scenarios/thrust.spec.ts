import { expect } from "chai";
import "mocha";
// Vector might not be used if explicit assertions are simple enough or removed
// import { Vector } from "matter-js";
import { IScenario } from "./types";

// Import consolidated scenario
import { thrustScenario } from "./thrust.scenario";
import { runScenario, runTestAndSnapshot } from "./test-runner.helper";

describe("PhysicsEngine Basic Actions: Thrust", () => {
  // Removed explicit 1-step assertion test in favor of snapshot test at step 1

  // Dynamically generate snapshot tests
  if (thrustScenario.snapshotSteps) {
    thrustScenario.snapshotSteps.forEach((steps) => {
      it(`should match snapshot after ${steps} steps of thrust`, () => {
        runTestAndSnapshot(
          thrustScenario,
          thrustScenario.id, // Use scenario ID as base name
          steps
        );
      });
    });
  }
});
