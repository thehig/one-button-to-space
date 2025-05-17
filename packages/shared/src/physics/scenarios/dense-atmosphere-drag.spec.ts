import { expect } from "chai";
import "mocha";
import { Vector } from "matter-js";
import { IScenario } from "./types";

import { denseAtmosphereDragScenario } from "./dense-atmosphere-drag.scenario";
import { runScenario, runTestAndSnapshot } from "./test-runner.helper";

describe("PhysicsEngine Environmental Effects: Dense Atmospheric Drag", () => {
  // Removed explicit 1-step assertion test in favor of snapshot test at step 1

  if (denseAtmosphereDragScenario.snapshotSteps) {
    denseAtmosphereDragScenario.snapshotSteps.forEach((steps) => {
      it(`should match snapshot after ${steps} steps of dense atmospheric drag`, () => {
        runTestAndSnapshot(
          denseAtmosphereDragScenario,
          denseAtmosphereDragScenario.id,
          steps
        );
      });
    });
  }
});
