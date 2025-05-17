import { expect } from "chai";
import "mocha";
import Matter from "matter-js"; // Matter might not be used directly if assertions are simple
import {
  IScenario,
  ICustomBodyPlugin, // Keep if used in explicit test assertions
} from "./types";
// PhysicsEngine import removed

// Import consolidated scenario
import { atmosphericHeatingScenario } from "./atmospheric-heating.scenario";
import { runScenario, runTestAndSnapshot } from "./test-runner.helper";

describe("PhysicsEngine Environmental Effects: Atmospheric Heating", () => {
  // Removed explicit 1-step assertion test in favor of snapshot test at step 1

  // Dynamically generate snapshot tests
  if (atmosphericHeatingScenario.snapshotSteps) {
    atmosphericHeatingScenario.snapshotSteps.forEach((steps) => {
      it(`should match snapshot after ${steps} steps of atmospheric heating`, () => {
        runTestAndSnapshot(
          atmosphericHeatingScenario,
          atmosphericHeatingScenario.id, // Use scenario ID
          steps
        );
      });
    });
  }
});
