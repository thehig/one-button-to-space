import { expect } from "chai";
import "mocha";
import { Vector } from "matter-js";
import { IScenario } from "./types";

import { atmosphericDragScenario } from "./atmospheric-drag.scenario";
import { runScenario, runTestAndSnapshot } from "./test-runner.helper";

describe("PhysicsEngine Environmental Effects: Atmospheric Drag", () => {
  // Removed explicit 1-step assertion test in favor of snapshot test at step 1

  if (atmosphericDragScenario.snapshotSteps) {
    atmosphericDragScenario.snapshotSteps.forEach((steps) => {
      it(`should match snapshot after ${steps} steps of atmospheric drag`, () => {
        runTestAndSnapshot(
          atmosphericDragScenario,
          atmosphericDragScenario.id,
          steps
        );
      });
    });
  }
});
