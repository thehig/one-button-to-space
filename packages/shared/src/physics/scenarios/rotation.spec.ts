import { expect } from "chai";
import "mocha";
// import * as fs from "fs"; // No longer needed
// import * as path from "path"; // No longer needed
import {
  IScenario,
  ISerializedPhysicsEngineState,
  ISerializedMatterBody,
} from "./types";

// Import consolidated scenario
import { rotationScenario } from "./rotation.scenario";
// Import runTestAndSnapshot from the helper
import { runScenario, runTestAndSnapshot } from "./test-runner.helper";

// const snapshotDir = path.join(__dirname, "__snapshots__"); // No longer needed

// // Local runTestAndSnapshot removed
// const runTestAndSnapshot = (
//   // ... implementation removed ...
// );

describe("PhysicsEngine Basic Actions: Rotation", () => {
  // Removed explicit 1-step assertion test in favor of snapshot test at step 1

  // Dynamically generate snapshot tests
  if (rotationScenario.snapshotSteps) {
    rotationScenario.snapshotSteps.forEach((steps) => {
      it(`should match snapshot after ${steps} steps of rotation`, () => {
        runTestAndSnapshot(
          rotationScenario,
          rotationScenario.id, // Use scenario ID as base name
          steps
        );
      });
    });
  }
});
