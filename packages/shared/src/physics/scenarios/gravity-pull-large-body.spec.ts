import { expect } from "chai";
import "mocha";
import { Vector } from "matter-js";
import { IScenario } from "./types";

// Import consolidated scenario
import { gravityPullLargeBodyScenario } from "./gravity-pull-large-body.scenario";
import { runScenario, runTestAndSnapshot } from "./test-runner.helper";

describe("PhysicsEngine Celestial Mechanics: Gravity Pull (Large)", () => {
  // Removed explicit 1-step assertion test in favor of snapshot test at step 1

  // Dynamically generate snapshot tests
  if (gravityPullLargeBodyScenario.snapshotSteps) {
    gravityPullLargeBodyScenario.snapshotSteps.forEach((steps) => {
      it(`should match snapshot after ${steps} steps of gravity pull (large body)`, () => {
        runTestAndSnapshot(
          gravityPullLargeBodyScenario,
          gravityPullLargeBodyScenario.id,
          steps
        );
      });
    });
  }
});
