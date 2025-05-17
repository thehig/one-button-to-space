import { expect } from "chai";
import "mocha";
// import * as fs from "fs"; // No longer needed
// import * as path from "path"; // No longer needed
import { ISerializedPhysicsEngineState, IScenario } from "./types";

import { determinismBaseScenario } from "./determinism.scenario";
// Import runTestAndSnapshot from the helper
import { runScenario, runTestAndSnapshot } from "./test-runner.helper";

describe("determinism", () => {
  // Removed explicit determinism test (lines 10-39) in favor of snapshot tests.

  // Dynamically generate snapshot tests
  if (determinismBaseScenario.snapshotSteps) {
    determinismBaseScenario.snapshotSteps.forEach((steps) => {
      it(`should match known good simulation data (snapshot at ${steps} steps)`, () => {
        runTestAndSnapshot(
          determinismBaseScenario,
          // Use a base name that matches the old snapshot file if possible,
          // or decide on a new one. Old was "PhysicsEngine.determinism.snap.json"
          "PhysicsEngine.determinism",
          steps
        );
      });
    });
  }
});
