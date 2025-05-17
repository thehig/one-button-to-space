import { expect } from "chai";
import "mocha";
import { Vector } from "matter-js";
import { IScenario } from "./types";

// Import consolidated scenario
import { gravityPullVeryLargeBodyScenario } from "./gravity-pull-very-large-body.scenario";
import { runScenario, runTestAndSnapshot } from "./test-runner.helper";

describe("PhysicsEngine Celestial Mechanics: Gravity Pull (Very Large)", () => {
  // Removed explicit 1-step assertion test in favor of snapshot test at step 1

  // Dynamically generate snapshot tests
  if (gravityPullVeryLargeBodyScenario.snapshotSteps) {
    gravityPullVeryLargeBodyScenario.snapshotSteps.forEach((steps) => {
      it(`should match snapshot after ${steps} steps of gravity pull (very large body)`, () => {
        runTestAndSnapshot(
          gravityPullVeryLargeBodyScenario,
          gravityPullVeryLargeBodyScenario.id,
          steps
        );
      });
    });
  }
});
