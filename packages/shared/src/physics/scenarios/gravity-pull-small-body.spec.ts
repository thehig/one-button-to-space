import { expect } from "chai";
import "mocha";
import { Vector } from "matter-js";
import { IScenario } from "./types";

// Import consolidated scenario
import { gravityPullSmallBodyScenario } from "./gravity-pull-small-body.scenario";
import { runScenario, runTestAndSnapshot } from "./test-runner.helper";

describe("PhysicsEngine Celestial Mechanics: Gravity Pull (Small)", () => {
  // Removed explicit 1-step assertion test in favor of snapshot test at step 1

  // Dynamically generate snapshot tests
  if (gravityPullSmallBodyScenario.snapshotSteps) {
    gravityPullSmallBodyScenario.snapshotSteps.forEach((steps) => {
      it(`should match snapshot after ${steps} steps of gravity pull (small body)`, () => {
        runTestAndSnapshot(
          gravityPullSmallBodyScenario,
          gravityPullSmallBodyScenario.id, // Use scenario ID
          steps
        );
      });
    });
  }
});
